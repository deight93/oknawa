import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js';
import { getEnv } from '../lib/env.ts';
import { fetchPopularSubwayList, fetchStationData } from '../lib/api.ts';
import { syncPopularMeetingLocations } from '../lib/popular-location-sync.ts';
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const subwayNames = await fetchPopularSubwayList();

    return syncPopularMeetingLocations({
      supabase,
      type: 'station',
      sourceNames: subwayNames,
      fetchLocationData: fetchStationData,
      successMessage: '지하철 이용객 상위 100개 장소 최신화 완료',
    });
  } catch (error) {
    console.error('location-meeting error:', error);
    return responseError(error);
  }
});
