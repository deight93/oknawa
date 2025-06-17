import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { json } from "../lib/utils.ts"
import { getEnv } from "../lib/env.ts";

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ msg: "Method Not Allowed" }, 405);

  const url = new URL(req.url);
  // /location-points-confirm/{map_id}
  const map_id = url.pathname.split("/").pop();

  if (!map_id) return json({ msg: "map_id required" }, 400);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ msg: "Invalid JSON" }, 400);
  }
  const { map_host_id, share_key } = body;
  if (!map_host_id || !share_key) return json({ msg: "map_host_id, share_key required" }, 400);

  const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. 데이터 읽기
  const { data, error } = await supabase
      .from("location_result")
      .select("map_host_id, station_info")
      .eq("map_id", map_id)
      .maybeSingle();

  if (error || !data) return json({ msg: "Not Found" }, 404);

  if (data.map_host_id !== map_host_id) {
    return json({ msg: "Not Permission" }, 403);
  }

  const found = data.station_info.some((item: any) => item.share_key === share_key);
  if (!found) return json({ msg: "share_key not found" }, 404);

  // 2. update confirmed
  const { error: updateError } = await supabase
      .from("location_result")
      .update({ confirmed: share_key })
      .eq("map_id", map_id);

  if (updateError) return json({ msg: "DB Update Failed" }, 500);

  return json({ msg: "투표 확정 완료" });
});
