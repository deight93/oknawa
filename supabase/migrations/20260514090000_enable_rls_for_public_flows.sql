ALTER TABLE public.location_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_room ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popular_meeting_location ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_itinerary_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_place_quality_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_vote ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_read_location_result ON public.location_result;
DROP POLICY IF EXISTS anon_read_station_info ON public.station_info;
DROP POLICY IF EXISTS anon_read_location_room ON public.location_room;
DROP POLICY IF EXISTS anon_read_participant ON public.participant;

REVOKE SELECT ON public.location_result FROM anon;
REVOKE SELECT ON public.station_info FROM anon;
REVOKE SELECT ON public.location_room FROM anon;
REVOKE SELECT ON public.participant FROM anon;
REVOKE SELECT ON public.popular_meeting_location FROM anon;
REVOKE SELECT ON public.route_itinerary_cache FROM anon;
REVOKE SELECT ON public.station_place_quality_cache FROM anon;
REVOKE SELECT ON public.location_vote FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.location_result FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.station_info FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.location_room FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.participant FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.popular_meeting_location FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.route_itinerary_cache FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.station_place_quality_cache FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.location_vote FROM anon;

CREATE OR REPLACE FUNCTION public.location_result_by_map_id(
    p_map_id uuid
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT to_jsonb(location_result.*) ||
           jsonb_build_object(
               'station_info',
               COALESCE(
                   (
                       SELECT jsonb_agg(to_jsonb(station_info.*) ORDER BY station_info.id)
                       FROM public.station_info
                       WHERE station_info.map_id = location_result.map_id
                   ),
                   '[]'::jsonb
               )
           )
    INTO v_result
    FROM public.location_result
    WHERE location_result.map_id = p_map_id
    LIMIT 1;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.location_station_by_share_key(
    p_share_key text
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT to_jsonb(station_info.*) ||
           jsonb_build_object(
               'vote_round',
               COALESCE(location_result.vote_round, 1)
           )
    INTO v_result
    FROM public.station_info
    LEFT JOIN public.location_result
        ON location_result.map_id = station_info.map_id
    WHERE station_info.share_key = p_share_key
    LIMIT 1;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.location_room_status(
    p_room_id uuid
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT to_jsonb(location_room.*) ||
           jsonb_build_object(
               'participant',
               COALESCE(
                   (
                       SELECT jsonb_agg(to_jsonb(participant.*) ORDER BY participant.id)
                       FROM public.participant
                       WHERE participant.room_id = location_room.room_id
                   ),
                   '[]'::jsonb
               )
           )
    INTO v_result
    FROM public.location_room
    WHERE location_room.room_id = p_room_id
    LIMIT 1;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.location_together(
    name TEXT,
    region_name TEXT,
    full_address TEXT,
    start_x DOUBLE PRECISION,
    start_y DOUBLE PRECISION
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
    INSERT INTO public.location_room(room_id, room_host_id)
    VALUES (v_room_id, v_room_host_id);

    INSERT INTO public.participant(room_id, name, region_name, full_address, start_x, start_y)
    VALUES (v_room_id, name, region_name, full_address, start_x, start_y);

    RETURN jsonb_build_object(
        'room_id', v_room_id,
        'room_host_id', v_room_host_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.location_join_room(
    p_room_id UUID,
    p_name TEXT,
    p_region_name TEXT,
    p_full_address TEXT,
    p_start_x DOUBLE PRECISION,
    p_start_y DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_participant_id integer;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.location_room
        WHERE location_room.room_id = p_room_id
    ) THEN
        RAISE EXCEPTION 'Room not found'
            USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.participant(room_id, name, region_name, full_address, start_x, start_y)
    VALUES (p_room_id, p_name, p_region_name, p_full_address, p_start_x, p_start_y)
    RETURNING id INTO v_participant_id;

    RETURN jsonb_build_object(
        'msg', '출발지 등록 완료',
        'participant_id', v_participant_id
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
    ON CONFLICT (map_id, vote_round, voter_token) DO NOTHING
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

    RETURN jsonb_build_object(
        'msg', '재투표 시작 완료',
        'vote_round', v_vote_round
    );
END;
$$;

REVOKE ALL ON FUNCTION public.location_together(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_together_room_id(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_result_by_map_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_station_by_share_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_room_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_join_room(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_station_confirm(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_points_vote(uuid, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_confirm_cancel(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_vote_reset(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.location_together(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO anon;
GRANT EXECUTE ON FUNCTION public.location_result_by_map_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.location_station_by_share_key(text) TO anon;
GRANT EXECUTE ON FUNCTION public.location_room_status(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.location_join_room(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO anon;
GRANT EXECUTE ON FUNCTION public.location_station_confirm(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.location_points_vote(uuid, text, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.location_confirm_cancel(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.location_vote_reset(uuid, text) TO anon;
