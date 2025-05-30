-- 인기 있는 만남의 장소 테이블
CREATE TABLE public.popular_meeting_location (
                                                 id SERIAL PRIMARY KEY,
                                                 name TEXT NOT NULL,               -- 위치 이름
                                                 type TEXT NOT NULL,               -- 위치 타입 (예: station)
                                                 url TEXT NOT NULL,                -- 위치 url
                                                 address TEXT NOT NULL,            -- 위치 주소
                                                 location_x DOUBLE PRECISION NOT NULL,  -- x좌표
                                                 location_y DOUBLE PRECISION NOT NULL,  -- y좌표
                                                 created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,  -- 생성일시
                                                 updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,  -- 수정일시
                                                 deleted_at TIMESTAMP WITH TIME ZONE                             -- 삭제일시
);