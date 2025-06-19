import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { getEnv } from "../lib/env.ts";
import { getCenterCoordinates, getCenterLocations } from "../lib/distance.ts";
import { callGoogleMapItineraries } from "../lib/mapapi.ts";
import { responseJson } from "../lib/utils.ts";
import { corsHeaders } from "../lib/cors.ts";

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return responseJson("ok");
  }

  if (req.method !== "POST") {
    return responseJson({ error: "Method Not Allowed" }, 405);
  }

  try {
    const body = await req.json();
    const participants = body.participant;
    const priority = Number(new URL(req.url).searchParams.get("priority") ?? "4");

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return responseJson({ error: "invalid participant" }, 400);
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

    const { data: locRes, error: locErr } = await supabase
        .from("location_result")
        .insert({
          map_id: mapId,
          map_host_id: mapHostId,
          request_info: { participant: participants },
          confirmed: null,
        }).select("map_id, map_host_id")
        .maybeSingle();

    if (locErr || !locRes) {
      return responseJson({ msg: "location_result insert error", detail: locErr?.message }, 500);
    }

    const stationInfoBulk = stationInfoList.map(station => ({
      map_id: mapId,
      share_key: crypto.randomUUID(),
      vote: 0,
      end_x: station.end_x,
      end_y: station.end_y,
      address_name: station.address_name,
      station_name: station.station_name,
      itinerary: station.itinerary || [],
      request_info: { participant: participants },
    }));

    const { data: stationRes, error: stationErr } = await supabase
        .from("station_info")
        .insert(stationInfoBulk)
        .select();

    if (stationErr) {
      await supabase.from("location_result").delete().eq("map_id", mapId);
      return responseJson({ msg: "station_info insert error", detail: stationErr.message }, 500);
    }

    return new responseJson(locRes);

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
