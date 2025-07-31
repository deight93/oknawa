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
    id           SERIAL PRIMARY KEY,
    room_id      UUID REFERENCES location_room (room_id) ON DELETE CASCADE,
    name         TEXT             NOT NULL,
    region_name  TEXT             NOT NULL,
    full_address TEXT             NOT NULL,
    start_x      DOUBLE PRECISION NOT NULL,
    start_y      DOUBLE PRECISION NOT NULL
);


-- RPC
CREATE
OR REPLACE FUNCTION location_together_room_id(
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
        WHERE location_room.room_id = location_together_room_id.room_id
          AND location_room.room_host_id = location_together_room_id.room_host_id
    ) THEN
        RAISE EXCEPTION 'No permission or not found';
END IF;

DELETE
FROM participant
WHERE participant.room_id = location_together_room_id.room_id;

INSERT INTO participant (room_id, name, region_name, full_address, start_x, start_y)
SELECT location_together_room_id.room_id,
       p ->> 'name',
    p ->> 'region_name',
    p ->> 'full_address',
    (p ->> 'start_x')::double precision,
    (p ->> 'start_y')::double precision
FROM jsonb_array_elements(location_together_room_id.participants) AS p;
END;
$$;


CREATE
OR REPLACE FUNCTION location_together(
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
    v_room_host_id
TEXT := reverse(replace(v_room_id::TEXT, '-', ''));
BEGIN
    v_room_host_id
:= substring(v_room_host_id for 8);

INSERT INTO location_room(room_id, room_host_id)
VALUES (v_room_id, v_room_host_id);

INSERT INTO participant(room_id, name, region_name, full_address, start_x, start_y)
VALUES (v_room_id, name, region_name, full_address, start_x, start_y);

RETURN jsonb_build_object(
        'room_id', v_room_id,
        'room_host_id', v_room_host_id
       );
END;
$$;