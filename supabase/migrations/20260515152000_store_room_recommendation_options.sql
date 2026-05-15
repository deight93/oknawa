ALTER TABLE public.location_room
    ADD COLUMN IF NOT EXISTS recommendation_options JSONB;

CREATE OR REPLACE FUNCTION public.location_room_recommend_start(
    p_room_id uuid,
    p_room_host_id text,
    p_meeting_purpose text DEFAULT null,
    p_recommendation_options jsonb DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_updated_count integer;
BEGIN
    UPDATE public.location_room
    SET recommendation_status = 'generating',
        result_map_id = null,
        confirmed_share_key = null,
        meeting_purpose = p_meeting_purpose,
        recommendation_options = p_recommendation_options,
        updated_at = now()
    WHERE location_room.room_id = p_room_id
      AND location_room.room_host_id = p_room_host_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Room not found'
            USING ERRCODE = 'P0002';
    END IF;

    RETURN jsonb_build_object(
        'msg', '추천 생성 시작',
        'recommendation_status', 'generating',
        'recommendation_options', p_recommendation_options
    );
END;
$$;

REVOKE ALL ON FUNCTION public.location_room_recommend_start(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.location_room_recommend_start(uuid, text, text, jsonb) TO anon;
