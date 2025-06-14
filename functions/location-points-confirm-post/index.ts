import { serve } from "jsr:@supabase/functions";
import { createClient } from "jsr:@supabase/supabase-js";

serve(async (req) => {
  const url = new URL(req.url);
  const map_id = url.pathname.split("/").at(-2); // .../points/{map_id}/confirm
  const { map_host_id, share_key } = Object.fromEntries(url.searchParams);

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

  // 권한 확인
  if (data.map_host_id !== map_host_id)
    return new Response(JSON.stringify({ error: "Not Permission" }), { status: 403 });

  // confirmed 필드 업데이트
  const { error: updateError } = await supabase
      .from("location_result")
      .update({ confirmed: share_key })
      .eq("map_id", map_id);

  if (updateError)
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });

  return new Response(JSON.stringify({ msg: "투표 확정 완료" }), { headers: { "Content-Type": "application/json" } });
});
