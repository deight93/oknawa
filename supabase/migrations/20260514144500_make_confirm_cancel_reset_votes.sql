CREATE OR REPLACE FUNCTION public.location_confirm_cancel(
    p_map_id uuid,
    p_map_host_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_vote_round integer;
BEGIN
    UPDATE public.location_result
    SET confirmed = null,
        vote_round = location_result.vote_round + 1,
        updated_at = now()
    WHERE location_result.map_id = p_map_id
      AND location_result.map_host_id = p_map_host_id
    RETURNING vote_round INTO v_vote_round;

    IF v_vote_round IS NULL THEN
        RAISE EXCEPTION 'Location result not found'
            USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.station_info
    SET vote = 0,
        updated_at = now()
    WHERE station_info.map_id = p_map_id;

    UPDATE public.location_room
    SET confirmed_share_key = null,
        updated_at = now()
    WHERE location_room.result_map_id = p_map_id;

    RETURN jsonb_build_object(
        'msg', '확정 취소 및 재투표 시작 완료',
        'vote_round', v_vote_round
    );
END;
$$;
