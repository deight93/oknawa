ALTER TABLE public.location_room
    ADD COLUMN recommendation_run_id UUID;

-- Joining and starting lock the same room row, so the returned snapshot includes
-- every successful registration and no later registration can be silently omitted.
CREATE OR REPLACE FUNCTION public.location_join_room(
    p_room_id UUID, p_name TEXT, p_region_name TEXT, p_full_address TEXT,
    p_start_x DOUBLE PRECISION, p_start_y DOUBLE PRECISION,
    p_travel_mode TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room public.location_room%ROWTYPE;
    v_participant_id INTEGER;
BEGIN
    IF p_travel_mode IS NOT NULL AND p_travel_mode NOT IN ('transit', 'car', 'walk') THEN
        RAISE EXCEPTION 'Invalid travel mode' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_room FROM public.location_room WHERE room_id = p_room_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_room.recommendation_status = 'generating'
       AND (v_room.recommendation_run_id IS NULL OR v_room.updated_at <= now() - interval '5 minutes') THEN
        UPDATE public.location_room
        SET recommendation_status = 'failed', recommendation_run_id = NULL,
            result_map_id = NULL, updated_at = now()
        WHERE room_id = p_room_id;
        v_room.recommendation_status := 'failed';
    END IF;
    IF v_room.recommendation_status IN ('generating', 'completed') THEN
        RAISE EXCEPTION '이미 추천이 시작된 방입니다. 방장에게 새 모임 링크를 요청해주세요.'
            USING ERRCODE = '55000';
    END IF;
    INSERT INTO public.participant(room_id, name, region_name, full_address, start_x, start_y, travel_mode)
    VALUES (p_room_id, p_name, p_region_name, p_full_address, p_start_x, p_start_y, p_travel_mode)
    RETURNING id INTO v_participant_id;
    RETURN jsonb_build_object('msg', '출발지 등록 완료', 'participant_id', v_participant_id);
END;
$$;

-- Remove the older overload: its unguarded UPDATE must not remain callable.
DROP FUNCTION public.location_room_recommend_start(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.location_room_recommend_start(
    p_room_id UUID,
    p_room_host_id TEXT,
    p_meeting_purpose TEXT DEFAULT NULL,
    p_recommendation_options JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room public.location_room%ROWTYPE;
    v_run_id UUID := gen_random_uuid();
    v_participants JSONB;
BEGIN
    SELECT * INTO v_room FROM public.location_room
    WHERE room_id = p_room_id AND room_host_id = p_room_host_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_room.recommendation_status = 'generating'
       AND v_room.recommendation_run_id IS NOT NULL
       AND v_room.updated_at > now() - interval '5 minutes' THEN
        RAISE EXCEPTION '이미 추천이 진행 중입니다. 잠시 기다려주세요.' USING ERRCODE = '55000';
    END IF;
    UPDATE public.location_room
    SET recommendation_status = 'generating', recommendation_run_id = v_run_id,
        result_map_id = NULL, confirmed_share_key = NULL,
        meeting_purpose = p_meeting_purpose, recommendation_options = p_recommendation_options,
        updated_at = now()
    WHERE room_id = p_room_id;

    SELECT COALESCE(jsonb_agg(to_jsonb(participant.*) ORDER BY participant.id), '[]'::jsonb)
    INTO v_participants FROM public.participant WHERE room_id = p_room_id;
    RETURN jsonb_build_object(
        'recommendation_status', 'generating',
        'recommendation_run_id', v_run_id,
        'participant', v_participants
    );
END;
$$;

DROP FUNCTION public.location_room_recommend_complete(UUID, TEXT, UUID);
CREATE FUNCTION public.location_room_recommend_complete(
    p_room_id UUID, p_room_host_id TEXT, p_map_id UUID,
    p_recommendation_run_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_recommendation_run_id IS NULL THEN
        RAISE EXCEPTION '화면을 새로고침한 뒤 추천을 다시 시작해주세요.' USING ERRCODE = '55000';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.location_result WHERE map_id = p_map_id) THEN
        RAISE EXCEPTION 'Location result not found' USING ERRCODE = 'P0002';
    END IF;
    UPDATE public.location_room
    SET recommendation_status = 'completed', result_map_id = p_map_id,
        recommendation_run_id = NULL, updated_at = now()
    WHERE room_id = p_room_id AND room_host_id = p_room_host_id
      AND recommendation_status = 'generating'
      AND recommendation_run_id = p_recommendation_run_id
      AND updated_at > now() - interval '5 minutes';
    IF NOT FOUND THEN
        RAISE EXCEPTION '추천이 만료되었거나 다른 추천이 시작됐어요. 목록에서 다시 시도해주세요.' USING ERRCODE = '55000';
    END IF;
    RETURN jsonb_build_object('recommendation_status', 'completed', 'map_id', p_map_id);
END;
$$;

DROP FUNCTION public.location_room_recommend_fail(UUID, TEXT);
CREATE FUNCTION public.location_room_recommend_fail(
    p_room_id UUID, p_room_host_id TEXT,
    p_recommendation_run_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_recommendation_run_id IS NULL THEN
        RAISE EXCEPTION '화면을 새로고침한 뒤 추천을 다시 시작해주세요.' USING ERRCODE = '55000';
    END IF;
    UPDATE public.location_room
    SET recommendation_status = 'failed', result_map_id = NULL,
        recommendation_run_id = NULL, updated_at = now()
    WHERE room_id = p_room_id AND room_host_id = p_room_host_id
      AND recommendation_status = 'generating'
      AND recommendation_run_id = p_recommendation_run_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION '이미 종료되었거나 다른 추천이 시작됐어요.' USING ERRCODE = '55000';
    END IF;
    RETURN jsonb_build_object('recommendation_status', 'failed');
END;
$$;

CREATE OR REPLACE FUNCTION public.location_room_status(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- A closed/reloaded browser cannot finish its run. The next poll releases it;
    -- existing pre-migration runs without an identifier are also recoverable.
    UPDATE public.location_room
    SET recommendation_status = 'failed', recommendation_run_id = NULL,
        result_map_id = NULL, updated_at = now()
    WHERE room_id = p_room_id AND recommendation_status = 'generating'
      AND (recommendation_run_id IS NULL OR updated_at <= now() - interval '5 minutes');

    RETURN (
        SELECT jsonb_build_object(
            'room_id', room.room_id,
            'confirmed_share_key', room.confirmed_share_key,
            'result_map_id', room.result_map_id,
            'recommendation_status', room.recommendation_status,
            'meeting_purpose', room.meeting_purpose,
            'recommendation_options', room.recommendation_options,
            'created_at', room.created_at,
            'updated_at', room.updated_at,
            'participant', COALESCE((
                SELECT jsonb_agg(to_jsonb(participant.*) ORDER BY participant.id)
                FROM public.participant WHERE participant.room_id = room.room_id
            ), '[]'::jsonb)
        ) FROM public.location_room AS room WHERE room.room_id = p_room_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.location_join_room(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_room_recommend_start(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_room_recommend_complete(UUID, TEXT, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_room_recommend_fail(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_room_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.location_join_room(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.location_room_recommend_start(UUID, TEXT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.location_room_recommend_complete(UUID, TEXT, UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.location_room_recommend_fail(UUID, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.location_room_status(UUID) TO anon;
