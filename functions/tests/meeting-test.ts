import {
    assertEquals,
    assertArrayIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

Deno.test("Edge Function: meeting/index.ts - popular_meeting_location upsert test", async () => {
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 테스트 데이터 사전 제거
    await supabase
        .from("popular_meeting_location")
        .delete()
        .eq("name", "강남역");

    // Edge 함수 호출
    const response = await fetch("http://localhost:54321/functions/v1/meeting", {
        method: "GET", // 또는 POST, 실제 index.ts에 따라 조정
    });

    const json = await response.json();
    assertEquals(response.status, 200);
    assertEquals(json.msg, "인기 있는 장소 정보 업데이트 완료");

    // 실제 DB 확인
    const { data, error } = await supabase
        .from("popular_meeting_location")
        .select("*")
        .eq("name", "강남역");

    if (error) {
        throw new Error(`DB 오류: ${error.message}`);
    }

    assertEquals(data?.length ?? 0 > 0, true);
    assertArrayIncludes(Object.keys(data[0]), [
        "name",
        "location_x",
        "location_y",
        "url",
        "address",
    ]);
});
