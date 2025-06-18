CREATE TABLE location_room
(
    room_id             UUID PRIMARY KEY         DEFAULT gen_random_uuid(),
    room_host_id        TEXT                                   NOT NULL,
    confirmed_share_key TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE participant
(
    id          SERIAL PRIMARY KEY,
    room_id     UUID REFERENCES location_room (room_id) ON DELETE CASCADE,
    name        TEXT             NOT NULL,
    region_name TEXT             NOT NULL,
    start_x     DOUBLE PRECISION NOT NULL,
    start_y     DOUBLE PRECISION NOT NULL
);