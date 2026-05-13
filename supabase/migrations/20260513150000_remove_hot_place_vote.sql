DROP FUNCTION IF EXISTS public.location_hot_place_vote(uuid, text, integer, text, jsonb);

CREATE OR REPLACE FUNCTION public.location_confirm_cancel(
    p_map_id uuid,
    p_map_host_id text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_updated_count integer;
BEGIN
    UPDATE public.location_result
    SET confirmed = null,
        updated_at = now()
    WHERE location_result.map_id = p_map_id
      AND location_result.map_host_id = p_map_host_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count = 0 THEN
        RAISE EXCEPTION 'Location result not found'
            USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM public.confirmed_hot_place
    WHERE confirmed_hot_place.map_id = p_map_id;

    RETURN jsonb_build_object('msg', '확정 취소 완료');
END;
$$;

CREATE OR REPLACE FUNCTION public.location_vote_reset(
    p_map_id uuid,
    p_map_host_id text
)
RETURNS jsonb
LANGUAGE plpgsql
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

    DELETE FROM public.confirmed_hot_place
    WHERE confirmed_hot_place.map_id = p_map_id;

    RETURN jsonb_build_object(
        'msg', '재투표 시작 완료',
        'vote_round', v_vote_round
    );
END;
$$;

DROP TABLE IF EXISTS public.hot_place_vote;
