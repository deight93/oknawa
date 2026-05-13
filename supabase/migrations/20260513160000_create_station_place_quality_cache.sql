CREATE TABLE IF NOT EXISTS public.station_place_quality_cache
(
    cache_key   TEXT PRIMARY KEY,
    station_name TEXT NOT NULL,
    location_x  DOUBLE PRECISION NOT NULL,
    location_y  DOUBLE PRECISION NOT NULL,
    radius      INTEGER NOT NULL DEFAULT 500,
    food_count  INTEGER NOT NULL DEFAULT 0,
    cafe_count  INTEGER NOT NULL DEFAULT 0,
    drink_count INTEGER NOT NULL DEFAULT 0,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_station_place_quality_cache_expires_at
    ON public.station_place_quality_cache (expires_at);
