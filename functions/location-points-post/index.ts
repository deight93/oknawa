import { serve } from "jsr:@supabase/functions";
import { createClient } from "jsr:@supabase/supabase-js";

serve(async (req) => {
  const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const body = await req.json();

  // 1. map_id, map_host_id 생성
  const map_id = crypto.randomUUID();
  const map_host_id = map_id.replace("-", "").slice(0, 8).split("").reverse().join("");
  // 2. 중간 좌표, 인기역, 경로계산 등은 기존 python open_api를 JS로 재구현 필요 (여긴 stub 처리)
  const station_info = []; // TODO: 비즈니스 로직 구현 필요

  // 3. 결과 DB에 저장
  const { error } = await supabase.from("location_result").insert([{
    map_id,
    map_host_id,
    station_info,
    request_info: body,
    confirmed: null,
  }]);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // 4. 응답
  return new Response(JSON.stringify({
    map_id,
    map_host_id,
    station_info,
    request_info: body,
    confirmed: null,
  }), { headers: { "Content-Type": "application/json" } });
});
