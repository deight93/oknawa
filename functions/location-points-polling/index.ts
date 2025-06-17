import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import {getEnv} from "../lib/env.ts";
import {json} from "../lib/utils.ts";


const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method !== "GET") return json({ msg: "Method Not Allowed" }, 405);

  const url = new URL(req.url);
  // /location-points-polling/{map_id}
  const map_id = url.pathname.split("/").pop();

  if (!map_id) return json({ msg: "map_id required" }, 400);

  const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
      .from("location_result")
      .select("map_id,station_info,request_info,confirmed")
      .eq("map_id", map_id)
      .maybeSingle();

  if (error || !data) return json({ msg: "Not Found" }, 404);

  return json({
    map_id: data.map_id,
    station_info: data.station_info,
    request_info: data.request_info,
    confirmed: data.confirmed ?? null
  });
});
