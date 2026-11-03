-- Keep edit capabilities out of participant.* snapshots and public RPC readers.
-- Existing participants deliberately receive no capability or claim mechanism.
CREATE TABLE public.participant_edit_capability (
    participant_id INTEGER PRIMARY KEY REFERENCES public.participant(id) ON DELETE CASCADE,
    token TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT
);
ALTER TABLE public.participant_edit_capability ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.participant_edit_capability FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.location_together(
    name TEXT, region_name TEXT, full_address TEXT,
    start_x DOUBLE PRECISION, start_y DOUBLE PRECISION,
    travel_mode TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room_id UUID := gen_random_uuid();
    v_room_host_id TEXT := gen_random_uuid()::TEXT;
    v_participant_id INTEGER;
    v_participant_token TEXT;
BEGIN
    IF travel_mode IS NOT NULL AND travel_mode NOT IN ('transit', 'car', 'walk') THEN
        RAISE EXCEPTION 'Invalid travel mode' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.location_room(room_id, room_host_id)
    VALUES (v_room_id, v_room_host_id);
    INSERT INTO public.participant(room_id, name, region_name, full_address, start_x, start_y, travel_mode)
    VALUES (v_room_id, name, region_name, full_address, start_x, start_y, travel_mode)
    RETURNING id INTO v_participant_id;
    INSERT INTO public.participant_edit_capability(participant_id)
    VALUES (v_participant_id)
    RETURNING token INTO v_participant_token;
    RETURN jsonb_build_object(
        'room_id', v_room_id, 'room_host_id', v_room_host_id,
        'participant_id', v_participant_id, 'participant_token', v_participant_token
    );
END;
$$;

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
    v_participant_token TEXT;
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
    INSERT INTO public.participant_edit_capability(participant_id)
    VALUES (v_participant_id)
    RETURNING token INTO v_participant_token;
    RETURN jsonb_build_object(
        'msg', '출발지 등록 완료', 'participant_id', v_participant_id,
        'participant_token', v_participant_token
    );
END;
$$;

CREATE FUNCTION public.location_update_participant(
    p_room_id UUID, p_participant_id INTEGER, p_participant_token TEXT,
    p_name TEXT, p_region_name TEXT, p_full_address TEXT,
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
    -- Join, edit and recommendation start serialize on the same room row.
    SELECT * INTO v_room FROM public.location_room WHERE room_id = p_room_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid participant capability' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.participant AS participant
        JOIN public.participant_edit_capability AS capability ON capability.participant_id = participant.id
        WHERE participant.room_id = p_room_id AND participant.id = p_participant_id
          AND capability.token = p_participant_token
    ) THEN
        RAISE EXCEPTION 'Invalid participant capability' USING ERRCODE = '42501';
    END IF;
    IF p_name IS NULL OR p_name !~ '[^[:space:]]'
       OR p_region_name IS NULL OR p_region_name !~ '[^[:space:]]'
       OR p_full_address IS NULL OR p_full_address !~ '[^[:space:]]' THEN
        RAISE EXCEPTION 'Name and address are required' USING ERRCODE = '22023';
    END IF;
    -- PostgreSQL orders NaN above finite numbers, so these bounds also reject it
    -- and both infinities. NULL must be checked separately.
    IF p_start_x IS NULL OR p_start_x NOT BETWEEN -180 AND 180
       OR p_start_y IS NULL OR p_start_y NOT BETWEEN -90 AND 90 THEN
        RAISE EXCEPTION 'Invalid departure coordinates' USING ERRCODE = '22023';
    END IF;
    IF p_travel_mode IS NOT NULL AND p_travel_mode NOT IN ('transit', 'car', 'walk') THEN
        RAISE EXCEPTION 'Invalid travel mode' USING ERRCODE = '22023';
    END IF;

    -- Match join/status recovery, including older runs without an identifier.
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

    UPDATE public.participant
    SET name = p_name, region_name = p_region_name, full_address = p_full_address,
        start_x = p_start_x, start_y = p_start_y, travel_mode = p_travel_mode
    WHERE room_id = p_room_id AND id = p_participant_id
    RETURNING id INTO v_participant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid participant capability' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object('participant_id', v_participant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.location_together(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_join_room(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_update_participant(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.location_together(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.location_join_room(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.location_update_participant(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO anon;
