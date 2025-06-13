// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { normalizeStationName } from "../lib/normalize.ts";
import { getEnv } from "../lib/env.ts";
import { fetchPopularSubwayList, fetchStationData } from "../lib/api.ts"

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date().toISOString();

  const subwayNames = await fetchPopularSubwayList();

  const { data: existingList, error: existingListError } = await supabase
      .from("popular_meeting_location")
      .select("name")
      .is("deleted_at", null);

  if (existingListError) {
    console.error("DB 조회 실패:", existingListError);
    return new Response(JSON.stringify({ msg: "DB 조회 실패" }), { status: 500 });
  }

  const upsertItems: any[] = [];
  for (const subwayName of subwayNames) {
    const stations = await fetchStationData(subwayName);
    if (!stations.length) continue;

    const station = stations[0];

    const isExists =
        existingList?.some(
            (item) =>
                item.name === normalizeStationName(station.place_name)
        ) ?? false;

    if (!isExists) {
      upsertItems.push({
        name: station.place_name,
        type: "station",
        url: station.place_url,
        address: station.road_address_name ?? "",
        location_x: Number(station.x),
        location_y: Number(station.y),
        created_at: now,
        updated_at: now,
        deleted_at: null
      });
    } else {
      upsertItems.push({
        name: station.place_name,
        type: "station",
        url: station.place_url,
        address: station.road_address_name ?? "",
        location_x: Number(station.x),
        location_y: Number(station.y),
        updated_at: now,
        deleted_at: null
      });
    }
  }

  if (upsertItems.length > 0) {
    const { error: upsertError } = await supabase
        .from("popular_meeting_location")
        .upsert(
            upsertItems,
            { onConflict: "name"}
        );
    if (upsertError) {
      console.error("Upsert Error:", upsertError);
      return new Response(JSON.stringify({ msg: "DB upsert 실패" }), { status: 500 });
    }
  }

  const existingNames = existingList.map((item) => item.name);
  const namesToDelete = existingNames.filter(
      (name) => !subwayNames.includes(normalizeStationName(name))
  );
  if (namesToDelete.length > 0) {
    const encodedNames = namesToDelete.map((name) => `"${name}"`).join(",");

    const { error: deleteError } = await supabase
        .from("popular_meeting_location")
        .update({ deleted_at: now })
        .filter("name", "in", `(${encodedNames})`)
        .is("deleted_at", null);

    if (deleteError) {
      console.error("Soft delete error:", deleteError);
    }
  }

  return new Response(JSON.stringify({ msg: "인기 있는 장소 최신화 완료" }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});



