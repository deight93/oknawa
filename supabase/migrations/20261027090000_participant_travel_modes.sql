ALTER TABLE public.participant
    ADD COLUMN travel_mode TEXT CHECK (travel_mode IN ('transit', 'car', 'walk'));

-- Defaulted arguments keep older clients working; NULL preserves their group fallback.
DROP FUNCTION public.location_together(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION);
CREATE FUNCTION public.location_together(
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
BEGIN
    IF travel_mode IS NOT NULL AND travel_mode NOT IN ('transit', 'car', 'walk') THEN
        RAISE EXCEPTION 'Invalid travel mode' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.location_room(room_id, room_host_id)
    VALUES (v_room_id, v_room_host_id);
    INSERT INTO public.participant(room_id, name, region_name, full_address, start_x, start_y, travel_mode)
    VALUES (v_room_id, name, region_name, full_address, start_x, start_y, travel_mode);
    RETURN jsonb_build_object('room_id', v_room_id, 'room_host_id', v_room_host_id);
END;
$$;

DROP FUNCTION public.location_join_room(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION);
CREATE FUNCTION public.location_join_room(
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
    v_participant_id INTEGER;
BEGIN
    IF p_travel_mode IS NOT NULL AND p_travel_mode NOT IN ('transit', 'car', 'walk') THEN
        RAISE EXCEPTION 'Invalid travel mode' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.location_room WHERE room_id = p_room_id) THEN
        RAISE EXCEPTION 'Room not found' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.participant(room_id, name, region_name, full_address, start_x, start_y, travel_mode)
    VALUES (p_room_id, p_name, p_region_name, p_full_address, p_start_x, p_start_y, p_travel_mode)
    RETURNING id INTO v_participant_id;
    RETURN jsonb_build_object('msg', '출발지 등록 완료', 'participant_id', v_participant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.location_together(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.location_together(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO anon;
REVOKE ALL ON FUNCTION public.location_join_room(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.location_join_room(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO anon;
