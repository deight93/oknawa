CREATE TABLE public.confirmed_hot_place
(
    id                       BIGSERIAL PRIMARY KEY,
    map_id                   UUID NOT NULL,
    share_key                TEXT NOT NULL,
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
    confirmed_at             TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at               TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT confirmed_hot_place_category_check
        CHECK (category IN ('food', 'cafe', 'drink')),
    CONSTRAINT confirmed_hot_place_map_share_fkey
        FOREIGN KEY (map_id, share_key)
            REFERENCES public.station_info (map_id, share_key)
            ON DELETE CASCADE,
    CONSTRAINT confirmed_hot_place_map_share_unique
        UNIQUE (map_id, share_key)
);

CREATE INDEX idx_confirmed_hot_place_share_key
    ON public.confirmed_hot_place (share_key);

CREATE OR REPLACE FUNCTION public.location_hot_place_confirm(
    p_map_id uuid,
    p_map_host_id text,
    p_share_key text,
    p_category text,
    p_place jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_confirmed_hot_place_id bigint;
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
          AND location_result.map_host_id = p_map_host_id
          AND location_result.confirmed = p_share_key
    ) THEN
        RAISE EXCEPTION 'Confirmed station not found'
            USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.confirmed_hot_place (
        map_id,
        share_key,
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
        raw_place
    )
    VALUES (
        p_map_id,
        p_share_key,
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
        p_place
    )
    ON CONFLICT (map_id, share_key)
    DO UPDATE SET
        category = EXCLUDED.category,
        kakao_place_id = EXCLUDED.kakao_place_id,
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
        confirmed_at = now(),
        updated_at = now()
    RETURNING id INTO v_confirmed_hot_place_id;

    RETURN jsonb_build_object(
        'msg', '핫플 확정 완료',
        'confirmed_hot_place_id', v_confirmed_hot_place_id
    );
END;
$$;
