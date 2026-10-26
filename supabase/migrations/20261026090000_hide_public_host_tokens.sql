-- Host capabilities are returned only to the creator, never by public reads.
-- Explicit fields also prevent future private columns from leaking through these RPCs.
CREATE OR REPLACE FUNCTION public.location_result_by_map_id(p_map_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'map_id', result.map_id,
        'request_info', result.request_info,
        'confirmed', result.confirmed,
        'vote_round', result.vote_round,
        'created_at', result.created_at,
        'updated_at', result.updated_at,
        'station_info', COALESCE((
            SELECT jsonb_agg(to_jsonb(station.*) ORDER BY station.id)
            FROM public.station_info AS station
            WHERE station.map_id = result.map_id
        ), '[]'::jsonb)
    )
    FROM public.location_result AS result
    WHERE result.map_id = p_map_id;
$$;

CREATE OR REPLACE FUNCTION public.location_room_status(p_room_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'room_id', room.room_id,
        'confirmed_share_key', room.confirmed_share_key,
        'result_map_id', room.result_map_id,
        'recommendation_status', room.recommendation_status,
        'meeting_purpose', room.meeting_purpose,
        'recommendation_options', room.recommendation_options,
        'created_at', room.created_at,
        'updated_at', room.updated_at,
        'participant', COALESCE((
            SELECT jsonb_agg(to_jsonb(participant.*) ORDER BY participant.id)
            FROM public.participant
            WHERE participant.room_id = room.room_id
        ), '[]'::jsonb)
    )
    FROM public.location_room AS room
    WHERE room.room_id = p_room_id;
$$;

REVOKE ALL ON FUNCTION public.location_result_by_map_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_room_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.location_result_by_map_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.location_room_status(uuid) TO anon;
