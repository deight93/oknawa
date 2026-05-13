CREATE TABLE public.route_itinerary_cache
(
    route_key     TEXT PRIMARY KEY,
    route_payload JSONB                                  NOT NULL,
    origin_x      DOUBLE PRECISION                       NOT NULL,
    origin_y      DOUBLE PRECISION                       NOT NULL,
    destination_x DOUBLE PRECISION                       NOT NULL,
    destination_y DOUBLE PRECISION                       NOT NULL,
    travel_mode   TEXT                                   NOT NULL DEFAULT 'SUBWAY',
    expires_at    TIMESTAMP WITH TIME ZONE               NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_route_itinerary_cache_expires_at
    ON public.route_itinerary_cache (expires_at);
