import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { fetchTerminalList, fetchTerminalData } from "../lib/api.ts";
import { getEnv } from "../lib/env.ts";
import { responseJson } from "../lib/utils.ts";
import {normalizeStationName} from "../lib/normalize.ts";

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return responseJson("ok");
  }

  if (req.method !== "POST") {
    return responseJson({ error: "Method Not Allowed" }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date().toISOString();

  const terminalNames = Array.from(new Set(await fetchTerminalList()));

  const { data: existingList, error: existingListError } = await supabase
      .from("popular_meeting_location")
      .select("name, type")
      .is("deleted_at", null)
      .eq("type", "station");

  if (existingListError) {
    console.error("DB 조회 실패:", existingListError);
    return responseJson({ msg: "DB 조회 실패" }, 500);
  }

  const upsertItems: any[] = [];
  for (const terminalName of terminalNames) {
    const stations = await fetchTerminalData(terminalName);
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
        type: "terminal",
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
        type: "terminal",
        url: station.place_url,
        address: station.road_address_name ?? "",
        location_x: Number(station.x),
        location_y: Number(station.y),
        updated_at: now,
        deleted_at: null
      });
    }
  }

  const uniqueUpsertItems = Array.from(
      new Map(upsertItems.map(item => [item.name, item])).values()
  );

  if (uniqueUpsertItems.length > 0) {
    const { error: upsertError } = await supabase
        .from("popular_meeting_location")
        .upsert(uniqueUpsertItems, { onConflict: "name" });
    if (upsertError) {
      console.error("Upsert Error:", upsertError);
      return new Response(JSON.stringify({ msg: "DB upsert 실패" }), { status: 500 });
    }
  }

  const existingNames = existingList.map((item) => item.name);
  const namesToDelete = existingNames.filter(
      (name) => !terminalNames.includes(normalizeStationName(name))
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
  return responseJson({ msg: "터미널 장소 최신화 완료" });
});