-- (예시) 투표/방/세션 테이블, 필요에 따라 추가 설계
CREATE TABLE public.location_room (
                                      room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                      room_host_id TEXT NOT NULL,
                                      confirmed_share_key TEXT,
                                      created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
                                      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- (예시) 참여자와 방 매핑 테이블
CREATE TABLE public.location_room_participant (
                                                  id SERIAL PRIMARY KEY,
                                                  room_id UUID REFERENCES public.location_room(room_id) ON DELETE CASCADE,
                                                  participant_id INT REFERENCES public.participant(id) ON DELETE CASCADE
);