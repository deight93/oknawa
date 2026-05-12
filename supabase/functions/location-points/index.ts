import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js';
import { getEnv } from '../lib/env.ts';
import {
  buildStationInfoInserts,
  buildStationItineraries,
  createLocationResult,
  fetchPopularMeetingLocations,
  insertStationInfo,
  isResponse,
  parseLocationPointsRequest,
  resolveRecommendType,
} from '../lib/location-points.ts';
import { responseError, responseJson } from '../lib/utils.ts';

const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return responseJson('ok');
  }

  if (req.method !== 'POST') {
    return responseJson({ error: 'Method Not Allowed' }, 405);
  }

  try {
    const requestData = await parseLocationPointsRequest(req);
    if (isResponse(requestData)) return requestData;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const recommendType = resolveRecommendType(requestData.participants);
    const locations = await fetchPopularMeetingLocations(
      supabase,
      recommendType,
    );
    if (isResponse(locations)) return locations;

    const stationInfoList = await buildStationItineraries(
      requestData.participants,
      locations,
      requestData.priority,
    );
    if (isResponse(stationInfoList)) return stationInfoList;

    const locationResult = await createLocationResult(
      supabase,
      requestData.participants,
    );
    if (isResponse(locationResult)) return locationResult;

    const stationInfoBulk = buildStationInfoInserts(
      locationResult.map_id,
      requestData.participants,
      stationInfoList,
    );

    const stationInfoError = await insertStationInfo(
      supabase,
      locationResult.map_id,
      stationInfoBulk,
    );
    if (stationInfoError) return stationInfoError;

    return responseJson(locationResult);
  } catch (err) {
    console.error('Error:', err);
    return responseError(err);
  }
});
