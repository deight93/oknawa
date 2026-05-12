-- DDL
CREATE TABLE public.popular_meeting_location
(
    id         SERIAL PRIMARY KEY,
    name       TEXT                                   NOT NULL,                   -- 위치 이름
    type       TEXT                                   NOT NULL DEFAULT 'station', -- 위치 타입
    url        TEXT                                   NOT NULL,                   -- 위치 url
    address    TEXT                                   NOT NULL,                   -- 위치 주소
    location_x DOUBLE PRECISION                       NOT NULL,                   -- x좌표
    location_y DOUBLE PRECISION                       NOT NULL,                   -- y좌표
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.popular_meeting_location
    ADD CONSTRAINT uq_popular_meeting_location_name UNIQUE (name);
