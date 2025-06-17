import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { json } from "../lib/utils.ts";
import { getEnv } from "../lib/env.ts";

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
    if (req.method !== "POST") return json({ msg: "Method Not Allowed" }, 405);

    const url = new URL(req.url);
    // /location-points-vote/{map_id}
    const pathSplit = url.pathname.split("/");
    const map_id = pathSplit[pathSplit.length - 1];

    if (!map_id) return json({ msg: "map_id required" }, 400);

    let body;
    try {
        body = await req.json();
    } catch {
        return json({ msg: "Invalid JSON" }, 400);
    }
    const share_key = body.share_key;
    if (!share_key) return json({ msg: "share_key required" }, 400);

    const supabase = createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. 데이터 읽기
    const { data, error } = await supabase
        .from("location_result")
        .select("station_info")
        .eq("map_id", map_id)
        .maybeSingle();

    if (error || !data) return json({ msg: "Not Found" }, 404);

    // 2. station_info 중 share_key에 해당하는 항목의 vote만 +1
    let found = false;
    const station_info = data.station_info.map((item: any) => {
        if (item.share_key === share_key) {
            found = true;
            return { ...item, vote: (item.vote ?? 0) + 1 };
        }
        return item;
    });

    if (!found) return json({ msg: "share_key not found" }, 404);

    // 3. DB 업데이트
    const { error: updateError } = await supabase
        .from("location_result")
        .update({ station_info })
        .eq("map_id", map_id);

    if (updateError) return json({ msg: "DB Update Failed" }, 500);

    return json({ msg: "투표 완료" });
});
