ALTER TABLE public.location_room
    ADD COLUMN IF NOT EXISTS result_map_id UUID REFERENCES public.location_result (map_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS recommendation_status TEXT NOT NULL DEFAULT 'idle',
    ADD COLUMN IF NOT EXISTS meeting_purpose TEXT;

CREATE INDEX IF NOT EXISTS idx_location_room_result_map_id
    ON public.location_room (result_map_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'location_room_recommendation_status_check'
    ) THEN
        ALTER TABLE public.location_room
            ADD CONSTRAINT location_room_recommendation_status_check
            CHECK (recommendation_status IN ('idle', 'generating', 'completed', 'failed'));
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.location_room_recommend_start(
    p_room_id uuid,
    p_room_host_id text,
    p_meeting_purpose text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count integer;
BEGIN
    UPDATE public.location_room
    SET recommendation_status = 'generating',
        result_map_id = null,
        confirmed_share_key = null,
        meeting_purpose = p_meeting_purpose,
        updated_at = now()
    WHERE location_room.room_id = p_room_id
      AND location_room.room_host_id = p_room_host_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Room not found'
            USING ERRCODE = 'P0002';
    END IF;

    RETURN jsonb_build_object(
        'msg', '추천 생성 시작',
        'recommendation_status', 'generating'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.location_room_recommend_complete(
    p_room_id uuid,
    p_room_host_id text,
    p_map_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count integer;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.location_result
        WHERE location_result.map_id = p_map_id
    ) THEN
        RAISE EXCEPTION 'Location result not found'
            USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.location_room
    SET recommendation_status = 'completed',
        result_map_id = p_map_id,
        updated_at = now()
    WHERE location_room.room_id = p_room_id
      AND location_room.room_host_id = p_room_host_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Room not found'
            USING ERRCODE = 'P0002';
    END IF;

    RETURN jsonb_build_object(
        'msg', '추천 생성 완료',
        'recommendation_status', 'completed',
        'map_id', p_map_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.location_room_recommend_fail(
    p_room_id uuid,
    p_room_host_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count integer;
BEGIN
    UPDATE public.location_room
    SET recommendation_status = 'failed',
        result_map_id = null,
        updated_at = now()
    WHERE location_room.room_id = p_room_id
      AND location_room.room_host_id = p_room_host_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Room not found'
            USING ERRCODE = 'P0002';
    END IF;

    RETURN jsonb_build_object(
        'msg', '추천 생성 실패',
        'recommendation_status', 'failed'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.location_station_confirm(
    p_map_id uuid,
    p_map_host_id text,
    p_share_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count integer;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.station_info
        WHERE station_info.map_id = p_map_id
          AND station_info.share_key = p_share_key
    ) THEN
        RAISE EXCEPTION 'Station result not found'
            USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.location_result
    SET confirmed = p_share_key,
        updated_at = now()
    WHERE location_result.map_id = p_map_id
      AND location_result.map_host_id = p_map_host_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Location result not found'
            USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.location_room
    SET confirmed_share_key = p_share_key,
        updated_at = now()
    WHERE location_room.result_map_id = p_map_id;

    RETURN jsonb_build_object('msg', '약속 지역 확정 완료');
END;
$$;

CREATE OR REPLACE FUNCTION public.location_points_vote(
    map_id uuid,
    share_key text,
    vote_round integer,
    voter_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vote_id bigint;
BEGIN
    IF voter_token IS NULL OR btrim(voter_token) = '' THEN
        RAISE EXCEPTION 'voter_token is required'
            USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.location_result
        WHERE location_result.map_id = location_points_vote.map_id
          AND location_result.vote_round = location_points_vote.vote_round
    ) THEN
        RAISE EXCEPTION 'Vote round not found'
            USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.location_vote (map_id, share_key, vote_round, voter_token)
    VALUES (
        location_points_vote.map_id,
        location_points_vote.share_key,
        location_points_vote.vote_round,
        location_points_vote.voter_token
    )
    ON CONFLICT ON CONSTRAINT location_vote_one_vote_per_round DO NOTHING
    RETURNING id INTO v_vote_id;

    IF v_vote_id IS NULL THEN
        RETURN jsonb_build_object(
            'msg', '이미 투표 완료',
            'already_voted', true
        );
    END IF;

    UPDATE public.station_info
    SET vote = station_info.vote + 1,
        updated_at = now()
    WHERE station_info.map_id = location_points_vote.map_id
      AND station_info.share_key = location_points_vote.share_key;

    RETURN jsonb_build_object(
        'msg', '투표 완료',
        'already_voted', false
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.location_confirm_cancel(
    p_map_id uuid,
    p_map_host_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count integer;
BEGIN
    UPDATE public.location_result
    SET confirmed = null,
        updated_at = now()
    WHERE location_result.map_id = p_map_id
      AND location_result.map_host_id = p_map_host_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Location result not found'
            USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.location_room
    SET confirmed_share_key = null,
        updated_at = now()
    WHERE location_room.result_map_id = p_map_id;

    RETURN jsonb_build_object('msg', '확정 취소 완료');
END;
$$;

CREATE OR REPLACE FUNCTION public.location_vote_reset(
    p_map_id uuid,
    p_map_host_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vote_round integer;
BEGIN
    UPDATE public.location_result
    SET confirmed = null,
        vote_round = location_result.vote_round + 1,
        updated_at = now()
    WHERE location_result.map_id = p_map_id
      AND location_result.map_host_id = p_map_host_id
    RETURNING vote_round INTO v_vote_round;

    IF v_vote_round IS NULL THEN
        RAISE EXCEPTION 'Location result not found'
            USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.station_info
    SET vote = 0,
        updated_at = now()
    WHERE station_info.map_id = p_map_id;

    UPDATE public.location_room
    SET confirmed_share_key = null,
        updated_at = now()
    WHERE location_room.result_map_id = p_map_id;

    RETURN jsonb_build_object(
        'msg', '재투표 시작 완료',
        'vote_round', v_vote_round
    );
END;
$$;

REVOKE ALL ON FUNCTION public.location_room_recommend_start(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_room_recommend_complete(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_room_recommend_fail(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.location_room_recommend_start(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.location_room_recommend_complete(uuid, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.location_room_recommend_fail(uuid, text) TO anon;
