ALTER TABLE public.station_info
    ADD COLUMN IF NOT EXISTS recommend_score DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_station_info_share_key
    ON public.station_info (share_key);

CREATE INDEX IF NOT EXISTS idx_participant_room_id
    ON public.participant (room_id);

CREATE TABLE IF NOT EXISTS public.location_vote
(
    id          BIGSERIAL PRIMARY KEY,
    map_id      UUID    NOT NULL,
    share_key   TEXT    NOT NULL,
    vote_round  INTEGER NOT NULL,
    voter_token TEXT    NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT location_vote_map_share_fkey
        FOREIGN KEY (map_id, share_key)
            REFERENCES public.station_info (map_id, share_key)
            ON DELETE CASCADE,
    CONSTRAINT location_vote_one_vote_per_round
        UNIQUE (map_id, vote_round, voter_token)
);

CREATE INDEX IF NOT EXISTS idx_location_vote_map_round
    ON public.location_vote (map_id, vote_round);

CREATE OR REPLACE FUNCTION public.location_station_confirm(
    p_map_id uuid,
    p_map_host_id text,
    p_share_key text
)
RETURNS jsonb
LANGUAGE plpgsql
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

DROP FUNCTION IF EXISTS public.location_points_vote(uuid, text);

CREATE OR REPLACE FUNCTION public.location_points_vote(
    map_id uuid,
    share_key text,
    vote_round integer,
    voter_token text
)
RETURNS jsonb
LANGUAGE plpgsql
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

CREATE OR REPLACE FUNCTION public.location_together(
    name TEXT,
    region_name TEXT,
    full_address TEXT,
    start_x DOUBLE PRECISION,
    start_y DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
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
