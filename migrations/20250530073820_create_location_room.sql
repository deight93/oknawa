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

create
or replace function replace_participants_for_room(
    room_id uuid,
    room_host_id text,
    participants jsonb
)
returns void
language plpgsql
as $$
begin
    if
not exists (
        select 1 from location_room
        where location_room.room_id = replace_participants_for_room.room_id
          and location_room.room_host_id = replace_participants_for_room.room_host_id
    ) then
        raise exception 'No permission or not found';
end if;

delete
from participant
where participant.room_id = replace_participants_for_room.room_id;

insert into participant (room_id, name, region_name, start_x, start_y)
select replace_participants_for_room.room_id,
       p ->>'name', p->>'region_name', (p->>'start_x'):: double precision, (p->>'start_y'):: double precision
from jsonb_array_elements(replace_participants_for_room.participants) as p;
end;
$$;
