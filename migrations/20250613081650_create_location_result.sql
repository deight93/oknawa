-- DDL
create table public.location_result
(
    map_id       uuid primary key         default gen_random_uuid(),
    map_host_id  text  not null,
    confirmed    text,
    created_at   timestamp with time zone default now(),
    updated_at   timestamp with time zone default now()
);

CREATE TABLE public.station_info
(
    id           BIGSERIAL PRIMARY KEY,
    map_id       UUID    NOT NULL REFERENCES location_result (map_id) ON DELETE CASCADE,
    share_key    TEXT    NOT NULL,
    vote         INTEGER NOT NULL         DEFAULT 0,
    end_x        DOUBLE PRECISION,
    end_y        DOUBLE PRECISION,
    address_name TEXT,
    station_name TEXT,
    itinerary    JSONB                    DEFAULT '[]',
    request_info JSONB,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_station_info_map_id ON public.station_info (map_id);

ALTER TABLE station_info
    ADD CONSTRAINT unique_mapid_sharekey UNIQUE (map_id, share_key);

ALTER TABLE location_result
    ADD CONSTRAINT fk_confirmed_share FOREIGN KEY (map_id, confirmed)
        REFERENCES station_info (map_id, share_key);

-- RPC
CREATE
OR REPLACE FUNCTION increase_vote(
    map_id uuid,
    share_key text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
BEGIN
UPDATE public.station_info
SET vote       = station_info.vote + 1,
    updated_at = now()
WHERE station_info.map_id = increase_vote.map_id
  AND station_info.share_key = increase_vote.share_key;

RETURN jsonb_build_object('msg', '투표 완료');
END;
$$;