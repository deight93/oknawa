create table public.location_result
(
    map_id       uuid primary key         default gen_random_uuid(),
    map_host_id  text  not null,
    confirmed    text,
    created_at   timestamp with time zone default now(),
    updated_at   timestamp with time zone default now()
);