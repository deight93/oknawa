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

    const { data: station, error: readErr } = await supabase
        .from("station_info")
        .select("vote")
        .eq("map_id", map_id)
        .eq("share_key", share_key)
        .maybeSingle();

    if (readErr || !station) {
        return json({ msg: "Not Found", detail: readErr?.message }, 404);
    }

    const newVote = station.vote + 1;
    const { error: updateErr } = await supabase
        .from("station_info")
        .update({ vote: newVote })
        .eq("map_id", map_id)
        .eq("share_key", share_key);

    if (updateErr) {
        return json({ msg: "Update Error", detail: updateErr.message }, 500);
    }

    return json({ msg: "투표 완료" });
});
