-- DDL
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

-- RPC
CREATE
OR REPLACE FUNCTION replace_participants_for_room(
    room_id uuid,
    room_host_id text,
    participants jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF
NOT EXISTS (
        SELECT 1 FROM location_room
        WHERE location_room.room_id = replace_participants_for_room.room_id
          AND location_room.room_host_id = replace_participants_for_room.room_host_id
    ) THEN
        RAISE EXCEPTION 'No permission or not found';
END IF;

DELETE
FROM participant
WHERE participant.room_id = replace_participants_for_room.room_id;

INSERT INTO participant (room_id, name, region_name, start_x, start_y)
SELECT replace_participants_for_room.room_id,
       p ->> 'name', p ->> 'region_name', (p ->> 'start_x'):: double precision, (p ->> 'start_y'):: double precision
FROM jsonb_array_elements(replace_participants_for_room.participants) AS p;
END;
$$;
