import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js';
import { fetchTerminalList, fetchTerminalData } from '../lib/api.ts';
import { getEnv } from '../lib/env.ts';
import { syncPopularMeetingLocations } from '../lib/popular-location-sync.ts';
import { responseJson } from '../lib/utils.ts';

const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return responseJson('ok');
  }

  if (req.method !== 'POST') {
    return responseJson({ error: 'Method Not Allowed' }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const terminalNames = Array.from(new Set(await fetchTerminalList()));

  return syncPopularMeetingLocations({
    supabase,
    type: 'terminal',
    sourceNames: terminalNames,
    fetchLocationData: fetchTerminalData,
    successMessage: '터미널 장소 최신화 완료',
  });
});
