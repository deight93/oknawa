import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js';
import { getEnv } from '../lib/env.ts';
import { handleLocationDestinationRequest } from '../lib/location-destination.ts';

Deno.serve(req =>
  handleLocationDestinationRequest(req, () =>
    createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  ),
);
