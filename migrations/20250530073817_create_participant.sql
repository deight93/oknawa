-- 참여자 모델
CREATE TABLE public.participant (
                                    id SERIAL PRIMARY KEY,
                                    name TEXT NOT NULL,
                                    region_name TEXT NOT NULL,
                                    start_x DOUBLE PRECISION NOT NULL,
                                    start_y DOUBLE PRECISION NOT NULL
);