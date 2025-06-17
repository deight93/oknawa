import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { getEnv } from "../lib/env.ts";
import { getCenterCoordinates, getCenterLocations } from "../lib/distance.ts";
import { callGoogleMapItineraries } from "../lib/mapapi.ts";
import { json } from "../lib/utils.ts";

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ msg: "Method Not Allowed" }, 405);

  try {
    const body = await req.json();
    const participants = body.participant;
    const priority = Number(new URL(req.url).searchParams.get("priority") ?? "4");

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return new Response(JSON.stringify({ error: "invalid participant" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. 인기역 데이터 가져오기
    const { data: stations, error } = await supabase
        .from("popular_meeting_location")
        .select("*")
        .is("deleted_at", null);
    if (error) throw new Error(error.message);

    // 2. 중간좌표 계산
    const centerCoordinates = getCenterCoordinates(participants);

    // 3. 가까운 역 추출
    const centerLocationDataList = getCenterLocations(centerCoordinates, stations, priority);

    // 4. 각 역에 대해 Google Map Itinerary 생성
    const stationInfoList = await callGoogleMapItineraries(participants, centerLocationDataList);

    // 5. 추가정보 세팅
    const mapId = crypto.randomUUID();
    const mapHostId = mapId.replace(/-/g, "").slice(0, 8).split("").reverse().join("");

    const resData = {
      map_id: mapId,
      map_host_id: mapHostId
    };

    await supabase
        .from("location_result")
        .insert({
          map_id: mapId,
          map_host_id: mapHostId,
          station_info: stationInfoList.map((station) => ({
            ...station,
            share_key: crypto.randomUUID(),
            vote: 0,
            request_info: { participant: participants },
          })),
          request_info: { participant: participants },
          confirmed: null,
        });

    return new json((resData));

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
