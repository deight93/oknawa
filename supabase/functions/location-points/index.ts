import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js';
import { getEnv } from '../lib/env.ts';
import {
  parseLocationPointsRequest,
  runLocationPointsFlow,
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
    if (!requestData.ok) return requestData.response;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const locationResult = await runLocationPointsFlow(
      supabase,
      requestData.data,
    );
    if (!locationResult.ok) return locationResult.response;

    return responseJson(locationResult.data);
  } catch (err) {
    console.error('Error:', err);
    return responseError(err);
  }
});
