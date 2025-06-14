import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";

Deno.serve(async (req) => {
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ msg: "Method Not Allowed" }), { status: 405 });
    }

    const url = new URL(req.url);
    const map_id = url.pathname.split("/").at(-2); // .../points/{map_id}/vote
    const { share_key } = Object.fromEntries(url.searchParams);

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!
    );

    // 데이터 가져오기
    const { data, error } = await supabase
        .from("location_result")
        .select("*")
        .eq("map_id", map_id)
        .single();

    if (error || !data)
        return new Response(JSON.stringify({ error: error?.message || "Not Found" }), { status: 404 });

    // station_info의 vote 증가
    let changed = false;
    for (const s of data.station_info) {
        if (s.share_key === share_key) {
            s.vote = (s.vote ?? 0) + 1;
            changed = true;
        }
    }
    if (!changed)
        return new Response(JSON.stringify({ error: "Share key not found" }), { status: 400 });

    // DB 업데이트
    const { error: updateError } = await supabase
        .from("location_result")
        .update({ station_info: data.station_info })
        .eq("map_id", map_id);

    if (updateError)
        return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });

    return new Response(JSON.stringify({ msg: "투표 완료" }), { headers: { "Content-Type": "application/json" } });
});
