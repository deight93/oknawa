CREATE TABLE public.hot_place_vote
(
    id                       BIGSERIAL PRIMARY KEY,
    map_id                   UUID NOT NULL,
    share_key                TEXT NOT NULL,
    vote_round               INTEGER NOT NULL DEFAULT 1,
    category                 TEXT NOT NULL,
    kakao_place_id           TEXT NOT NULL,
    place_name               TEXT NOT NULL,
    place_url                TEXT,
    address_name             TEXT,
    road_address_name        TEXT,
    phone                    TEXT,
    category_group_code      TEXT,
    category_group_name      TEXT,
    category_name            TEXT,
    x                        DOUBLE PRECISION,
    y                        DOUBLE PRECISION,
    main_photo_url           TEXT,
    day_business_hours_infos JSONB DEFAULT '[]'::jsonb,
    raw_place                JSONB NOT NULL DEFAULT '{}'::jsonb,
    vote                     INTEGER NOT NULL DEFAULT 0,
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at               TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT hot_place_vote_category_check
        CHECK (category IN ('food', 'cafe', 'drink')),
    CONSTRAINT hot_place_vote_map_share_fkey
        FOREIGN KEY (map_id, share_key)
            REFERENCES public.station_info (map_id, share_key)
            ON DELETE CASCADE,
    CONSTRAINT hot_place_vote_map_share_round_place_unique
        UNIQUE (map_id, share_key, vote_round, kakao_place_id)
);

CREATE INDEX idx_hot_place_vote_share_round_category
    ON public.hot_place_vote (share_key, vote_round, category);

CREATE OR REPLACE FUNCTION public.location_hot_place_vote(
    p_map_id uuid,
    p_share_key text,
    p_vote_round integer,
    p_category text,
    p_place jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_vote_count integer;
BEGIN
    IF p_category NOT IN ('food', 'cafe', 'drink') THEN
        RAISE EXCEPTION 'Invalid hot place category'
            USING ERRCODE = '22023';
    END IF;

    IF p_place IS NULL OR COALESCE(p_place ->> 'id', '') = '' THEN
        RAISE EXCEPTION 'Hot place id is required'
            USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.location_result
        WHERE location_result.map_id = p_map_id
          AND location_result.confirmed = p_share_key
          AND location_result.vote_round = p_vote_round
    ) THEN
        RAISE EXCEPTION 'Confirmed station not found'
            USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.hot_place_vote (
        map_id,
        share_key,
        vote_round,
        category,
        kakao_place_id,
        place_name,
        place_url,
        address_name,
        road_address_name,
        phone,
        category_group_code,
        category_group_name,
        category_name,
        x,
        y,
        main_photo_url,
        day_business_hours_infos,
        raw_place,
        vote
    )
    VALUES (
        p_map_id,
        p_share_key,
        p_vote_round,
        p_category,
        p_place ->> 'id',
        p_place ->> 'place_name',
        p_place ->> 'place_url',
        p_place ->> 'address_name',
        p_place ->> 'road_address_name',
        p_place ->> 'phone',
        p_place ->> 'category_group_code',
        p_place ->> 'category_group_name',
        p_place ->> 'category_name',
        NULLIF(p_place ->> 'x', '')::double precision,
        NULLIF(p_place ->> 'y', '')::double precision,
        p_place ->> 'main_photo_url',
        COALESCE(p_place -> 'day_business_hours_infos', '[]'::jsonb),
        p_place,
        1
    )
    ON CONFLICT (map_id, share_key, vote_round, kakao_place_id)
    DO UPDATE SET
        category = EXCLUDED.category,
        place_name = EXCLUDED.place_name,
        place_url = EXCLUDED.place_url,
        address_name = EXCLUDED.address_name,
        road_address_name = EXCLUDED.road_address_name,
        phone = EXCLUDED.phone,
        category_group_code = EXCLUDED.category_group_code,
        category_group_name = EXCLUDED.category_group_name,
        category_name = EXCLUDED.category_name,
        x = EXCLUDED.x,
        y = EXCLUDED.y,
        main_photo_url = EXCLUDED.main_photo_url,
        day_business_hours_infos = EXCLUDED.day_business_hours_infos,
        raw_place = EXCLUDED.raw_place,
        vote = hot_place_vote.vote + 1,
        updated_at = now()
    RETURNING vote INTO v_vote_count;

    RETURN jsonb_build_object(
        'msg', '최종 장소 투표 완료',
        'vote', v_vote_count
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.location_confirm_cancel(
    p_map_id uuid,
    p_map_host_id text
)
RETURNS jsonb
LANGUAGE plpgsql
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

    DELETE FROM public.confirmed_hot_place
    WHERE confirmed_hot_place.map_id = p_map_id;

    DELETE FROM public.hot_place_vote
    WHERE hot_place_vote.map_id = p_map_id;

    RETURN jsonb_build_object('msg', '확정 취소 완료');
END;
$$;

CREATE OR REPLACE FUNCTION public.location_vote_reset(
    p_map_id uuid,
    p_map_host_id text
)
RETURNS jsonb
LANGUAGE plpgsql
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

    DELETE FROM public.confirmed_hot_place
    WHERE confirmed_hot_place.map_id = p_map_id;

    DELETE FROM public.hot_place_vote
    WHERE hot_place_vote.map_id = p_map_id;

    RETURN jsonb_build_object(
        'msg', '재투표 시작 완료',
        'vote_round', v_vote_round
    );
END;
$$;
