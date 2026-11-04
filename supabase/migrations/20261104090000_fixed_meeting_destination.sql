-- Fixed destinations share room capabilities and recommendation leases with
-- midpoint rooms, but only their own authoritative results may be published.
CREATE FUNCTION public.location_meeting_destination_valid(p_destination JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
    IF jsonb_typeof(p_destination) IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_destination->'name') IS DISTINCT FROM 'string'
       OR jsonb_typeof(p_destination->'address') IS DISTINCT FROM 'string'
       OR jsonb_typeof(p_destination->'x') IS DISTINCT FROM 'number'
       OR jsonb_typeof(p_destination->'y') IS DISTINCT FROM 'number' THEN
        RETURN FALSE;
    END IF;
    -- JSON numeric types exclude NaN/infinity (PostgreSQL serializes those as
    -- strings). Numeric bounds also avoid overflow from large JSON numbers.
    RETURN (p_destination->>'name') ~ '[^[:space:]]'
       AND (p_destination->>'address') ~ '[^[:space:]]'
       AND (p_destination->>'x')::NUMERIC BETWEEN -180 AND 180
       AND (p_destination->>'y')::NUMERIC BETWEEN -90 AND 90
       AND p_destination - ARRAY['name', 'address', 'x', 'y'] = '{}'::JSONB;
END;
$$;
REVOKE ALL ON FUNCTION public.location_meeting_destination_valid(JSONB) FROM PUBLIC;

ALTER TABLE public.location_room
    ADD COLUMN meeting_destination JSONB,
    ADD CONSTRAINT location_room_meeting_destination_check CHECK (
        meeting_destination IS NULL OR public.location_meeting_destination_valid(meeting_destination)
    );

CREATE FUNCTION public.location_destination_together(
    name TEXT, region_name TEXT, full_address TEXT,
    start_x DOUBLE PRECISION, start_y DOUBLE PRECISION,
    travel_mode TEXT DEFAULT NULL,
    meeting_destination JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_created JSONB;
BEGIN
    IF NOT public.location_meeting_destination_valid(meeting_destination) THEN
        RAISE EXCEPTION 'Invalid meeting destination' USING ERRCODE = '22023';
    END IF;
    IF name IS NULL OR name !~ '[^[:space:]]'
       OR region_name IS NULL OR region_name !~ '[^[:space:]]'
       OR full_address IS NULL OR full_address !~ '[^[:space:]]' THEN
        RAISE EXCEPTION 'Name and address are required' USING ERRCODE = '22023';
    END IF;
    IF start_x IS NULL OR start_x NOT BETWEEN -180 AND 180
       OR start_y IS NULL OR start_y NOT BETWEEN -90 AND 90 THEN
        RAISE EXCEPTION 'Invalid departure coordinates' USING ERRCODE = '22023';
    END IF;

    -- Both writes are in the same RPC transaction. Reuse creator capability
    -- issuance rather than copying or weakening the participant edit contract.
    v_created := public.location_together(name, region_name, full_address, start_x, start_y, travel_mode);
    UPDATE public.location_room
    SET meeting_destination = location_destination_together.meeting_destination
    WHERE room_id = (v_created->>'room_id')::UUID;
    RETURN v_created;
END;
$$;

CREATE FUNCTION public.location_room_destination_update(
    p_room_id UUID, p_room_host_id TEXT, p_meeting_destination JSONB,
    p_expected_map_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room public.location_room%ROWTYPE;
BEGIN
    -- Serialize with registration, participant edits and recommendation start.
    SELECT * INTO v_room FROM public.location_room
    WHERE room_id = p_room_id AND room_host_id = p_room_host_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid room capability' USING ERRCODE = '42501';
    END IF;
    IF v_room.meeting_destination IS NULL THEN
        RAISE EXCEPTION 'Room does not have a fixed destination' USING ERRCODE = '22023';
    END IF;
    -- Compare while holding the room lock: a prior public status read cannot
    -- authorize resetting a newer result. Omitted/NULL means the list editor
    -- expects no result; result-page edits must identify the current map.
    IF v_room.result_map_id IS DISTINCT FROM p_expected_map_id THEN
        RAISE EXCEPTION '모임 결과가 변경됐어요. 새로고침한 뒤 다시 시도해주세요.' USING ERRCODE = '55000';
    END IF;
    IF NOT public.location_meeting_destination_valid(p_meeting_destination) THEN
        RAISE EXCEPTION 'Invalid meeting destination' USING ERRCODE = '22023';
    END IF;
    IF v_room.recommendation_status = 'generating'
       AND v_room.recommendation_run_id IS NOT NULL
       AND v_room.updated_at > now() - interval '5 minutes' THEN
        RAISE EXCEPTION '이미 추천이 진행 중입니다. 잠시 기다려주세요.' USING ERRCODE = '55000';
    END IF;
    -- Expired/legacy runs and completed rooms can reopen. No participant origin
    -- is modified, and a callback from the discarded run can no longer publish.
    UPDATE public.location_room
    SET meeting_destination = p_meeting_destination,
        recommendation_status = 'idle', recommendation_run_id = NULL,
        result_map_id = NULL, confirmed_share_key = NULL, updated_at = now()
    WHERE room_id = p_room_id;
    RETURN jsonb_build_object('meeting_destination', p_meeting_destination, 'recommendation_status', 'idle');
END;
$$;

CREATE OR REPLACE FUNCTION public.location_room_recommend_start(
    p_room_id UUID,
    p_room_host_id TEXT,
    p_meeting_purpose TEXT DEFAULT NULL,
    p_recommendation_options JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room public.location_room%ROWTYPE;
    v_run_id UUID := gen_random_uuid();
    v_participants JSONB;
BEGIN
    SELECT * INTO v_room FROM public.location_room
    WHERE room_id = p_room_id AND room_host_id = p_room_host_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Room not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_room.recommendation_status = 'generating'
       AND v_room.recommendation_run_id IS NOT NULL
       AND v_room.updated_at > now() - interval '5 minutes' THEN
        RAISE EXCEPTION '이미 추천이 진행 중입니다. 잠시 기다려주세요.' USING ERRCODE = '55000';
    END IF;
    SELECT COALESCE(jsonb_agg(to_jsonb(participant.*) ORDER BY participant.id), '[]'::JSONB)
    INTO v_participants FROM public.participant WHERE room_id = p_room_id;
    IF v_room.meeting_destination IS NOT NULL AND jsonb_array_length(v_participants) = 0 THEN
        RAISE EXCEPTION 'At least one participant is required' USING ERRCODE = '22023';
    END IF;

    UPDATE public.location_room
    SET recommendation_status = 'generating', recommendation_run_id = v_run_id,
        result_map_id = NULL, confirmed_share_key = NULL,
        meeting_purpose = p_meeting_purpose, recommendation_options = p_recommendation_options,
        updated_at = now()
    WHERE room_id = p_room_id;
    RETURN jsonb_build_object(
        'recommendation_status', 'generating',
        'recommendation_run_id', v_run_id,
        'participant', v_participants,
        'meeting_destination', v_room.meeting_destination
    );
END;
$$;

CREATE FUNCTION public.location_destination_run_input(
    p_room_id UUID, p_room_host_id TEXT, p_recommendation_run_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room public.location_room%ROWTYPE;
    v_participants JSONB;
BEGIN
    SELECT * INTO v_room FROM public.location_room
    WHERE room_id = p_room_id AND room_host_id = p_room_host_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid room capability' USING ERRCODE = '42501';
    END IF;
    IF v_room.meeting_destination IS NULL THEN
        RAISE EXCEPTION 'Room does not have a fixed destination' USING ERRCODE = '22023';
    END IF;
    IF p_recommendation_run_id IS NULL
       OR v_room.recommendation_status <> 'generating'
       OR v_room.recommendation_run_id IS DISTINCT FROM p_recommendation_run_id
       OR v_room.updated_at <= now() - interval '5 minutes' THEN
        RAISE EXCEPTION '추천이 만료되었거나 다른 추천이 시작됐어요. 목록에서 다시 시도해주세요.' USING ERRCODE = '55000';
    END IF;
    -- Explicit projection matches RouteParticipant and never returns edit or
    -- host capabilities. Registration/edit locks keep this snapshot stable
    -- throughout the live run; participantIndex follows participant.id.
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', participant.name,
        'region_name', participant.region_name,
        'full_address', participant.full_address,
        'start_x', participant.start_x,
        'start_y', participant.start_y,
        'travel_mode', participant.travel_mode
    ) ORDER BY participant.id), '[]'::JSONB)
    INTO v_participants FROM public.participant WHERE room_id = p_room_id;
    IF jsonb_array_length(v_participants) = 0 THEN
        RAISE EXCEPTION 'At least one participant is required' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('participant', v_participants, 'meeting_destination', v_room.meeting_destination);
END;
$$;

CREATE OR REPLACE FUNCTION public.location_room_recommend_complete(
    p_room_id UUID, p_room_host_id TEXT, p_map_id UUID,
    p_recommendation_run_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room public.location_room%ROWTYPE;
    v_request JSONB;
    v_input JSONB;
    v_routes JSONB;
BEGIN
    IF p_recommendation_run_id IS NULL THEN
        RAISE EXCEPTION '화면을 새로고침한 뒤 추천을 다시 시작해주세요.' USING ERRCODE = '55000';
    END IF;
    SELECT * INTO v_room FROM public.location_room
    WHERE room_id = p_room_id AND room_host_id = p_room_host_id FOR UPDATE;
    IF NOT FOUND
       OR v_room.recommendation_status <> 'generating'
       OR v_room.recommendation_run_id IS DISTINCT FROM p_recommendation_run_id
       OR v_room.updated_at <= now() - interval '5 minutes' THEN
        RAISE EXCEPTION '추천이 만료되었거나 다른 추천이 시작됐어요. 목록에서 다시 시도해주세요.' USING ERRCODE = '55000';
    END IF;
    SELECT request_info INTO v_request FROM public.location_result WHERE map_id = p_map_id FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Location result not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_room.meeting_destination IS NOT NULL THEN
        v_input := public.location_destination_run_input(p_room_id, p_room_host_id, p_recommendation_run_id);
        IF v_request->'destinationRoom' IS DISTINCT FROM jsonb_build_object(
                'roomId', p_room_id, 'runId', p_recommendation_run_id)
           OR v_request->'meetingDestination' IS DISTINCT FROM v_input->'meeting_destination'
           OR v_request->'participant' IS DISTINCT FROM v_input->'participant'
           OR EXISTS (SELECT 1 FROM public.station_info WHERE map_id = p_map_id) THEN
            RAISE EXCEPTION 'Result does not match the destination run input' USING ERRCODE = '22023';
        END IF;
        v_routes := v_request->'destinationRoutes';
        IF jsonb_typeof(v_routes) IS DISTINCT FROM 'array' THEN
            RAISE EXCEPTION 'Invalid destination routes' USING ERRCODE = '22023';
        END IF;
        -- Every participant has exactly one indexed outcome. Provider itinerary
        -- validation belongs to the Edge Function; SQL checks the stored envelope.
        IF jsonb_array_length(v_routes) <> jsonb_array_length(v_input->'participant')
           OR EXISTS (
               SELECT 1 FROM jsonb_array_elements(v_input->'participant') WITH ORDINALITY AS p(value, position)
               WHERE (SELECT count(*) FROM jsonb_array_elements(v_routes) AS r(value)
                      WHERE r.value->'participantIndex' = to_jsonb(p.position - 1)) <> 1
           )
           OR EXISTS (
               SELECT 1 FROM jsonb_array_elements(v_routes) AS r(value)
               WHERE jsonb_typeof(r.value) IS DISTINCT FROM 'object'
                  OR (r.value->>'status') IS NULL
                  OR (r.value->>'status') NOT IN ('ok', 'unavailable')
                  OR ((r.value->>'status') = 'ok' AND jsonb_typeof(r.value->'route') IS DISTINCT FROM 'object')
                  OR ((r.value->>'status') = 'unavailable' AND r.value ? 'route')
           ) THEN
            RAISE EXCEPTION 'Invalid destination routes' USING ERRCODE = '22023';
        END IF;
    END IF;

    UPDATE public.location_room
    SET recommendation_status = 'completed', result_map_id = p_map_id,
        recommendation_run_id = NULL, updated_at = now()
    WHERE room_id = p_room_id;
    RETURN jsonb_build_object('recommendation_status', 'completed', 'map_id', p_map_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.location_room_status(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.location_room
    SET recommendation_status = 'failed', recommendation_run_id = NULL,
        result_map_id = NULL, updated_at = now()
    WHERE room_id = p_room_id AND recommendation_status = 'generating'
      AND (recommendation_run_id IS NULL OR updated_at <= now() - interval '5 minutes');
    RETURN (
        SELECT jsonb_build_object(
            'room_id', room.room_id,
            'confirmed_share_key', room.confirmed_share_key,
            'result_map_id', room.result_map_id,
            'recommendation_status', room.recommendation_status,
            'meeting_purpose', room.meeting_purpose,
            'recommendation_options', room.recommendation_options,
            'meeting_destination', room.meeting_destination,
            'created_at', room.created_at,
            'updated_at', room.updated_at,
            'participant', COALESCE((
                SELECT jsonb_agg(to_jsonb(participant.*) ORDER BY participant.id)
                FROM public.participant WHERE participant.room_id = room.room_id
            ), '[]'::JSONB)
        ) FROM public.location_room AS room WHERE room.room_id = p_room_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.location_destination_together(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_room_destination_update(UUID, TEXT, JSONB, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_destination_run_input(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_room_recommend_start(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_room_recommend_complete(UUID, TEXT, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.location_room_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.location_destination_together(TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.location_room_destination_update(UUID, TEXT, JSONB, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.location_destination_run_input(UUID, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.location_room_recommend_start(UUID, TEXT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.location_room_recommend_complete(UUID, TEXT, UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.location_room_status(UUID) TO anon;

-- Supabase Edge Functions may use their service client for this RPC. BYPASSRLS
-- does not imply function EXECUTE; keep capability checks for either caller.
-- Local PGlite suites intentionally do not all define Supabase's service role.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.location_destination_run_input(UUID, TEXT, UUID) TO service_role;
    END IF;
END;
$$;
