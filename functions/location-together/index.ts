import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { json } from "../lib/utils.ts";
import { getEnv } from "../lib/env.ts";

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ msg: "Method Not Allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ msg: "Invalid JSON" }, 400);
  }

  const roomId = crypto.randomUUID();
  const roomHostId = roomId.replace(/-/g, "").slice(0, 8).split("").reverse().join("");

  const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: roomData, error: roomError } = await supabase
      .from("location_room")
      .insert({
        room_id: roomId,
        room_host_id: roomHostId,
      }).select("room_id, room_host_id")
      .maybeSingle();

  if (roomError) {
    return new Response(JSON.stringify({ msg: "Room Create Failed", error: roomError.message }), { status: 500 });
  }

  const participantBody = {
    ...body,
    room_id: roomId,
  };

  const { data: participant, error: participantError } = await supabase
      .from("participant")
      .insert([participantBody])
      .select()
      .single();

  if (participantError) {
    return new Response(JSON.stringify({ msg: "Participant Create Failed", error: participantError.message }), { status: 500 });
  }

  const response = {
    ...roomData,
  };

  return json(response);
});
