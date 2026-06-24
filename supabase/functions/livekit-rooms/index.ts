// Supabase Edge Function: livekit-rooms
//
// Returns live participant counts per Drop-in Room (from LiveKit, the source
// of truth) and reconciles the voice_rooms table — marking a room 'closed'
// when LiveKit shows nobody in it. This both powers the lobby headcount and
// cleans up rooms whose host closed the tab without leaving.
//
// Deploy:
//   supabase secrets set LIVEKIT_URL=wss://<project>.livekit.cloud
//   (LIVEKIT_API_KEY / LIVEKIT_API_SECRET are already set for livekit-token)
//   supabase functions deploy livekit-rooms

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { RoomServiceClient } from "npm:livekit-server-sdk@2";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Don't close a brand-new room before its host has had time to connect.
const GRACE_MS = 60_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("LIVEKIT_API_KEY");
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  const url = Deno.env.get("LIVEKIT_URL");
  // If LiveKit isn't fully configured, degrade gracefully (no counts, no cleanup).
  if (!apiKey || !apiSecret || !url) return json({ counts: {}, closed: [] });

  const host = url.replace("wss://", "https://").replace("ws://", "http://");

  const counts: Record<string, number> = {};
  try {
    const svc = new RoomServiceClient(host, apiKey, apiSecret);
    const rooms = await svc.listRooms();
    for (const r of rooms) counts[r.name] = r.numParticipants;
  } catch (e) {
    return json({ counts: {}, closed: [], error: e instanceof Error ? e.message : "LiveKit error" });
  }

  // Reconcile our registry with the service role (bypasses host-only RLS).
  const closed: string[] = [];
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: active } = await sb.from("voice_rooms").select("id, created_at").eq("status", "active");
    const now = Date.now();
    for (const row of (active ?? []) as { id: string; created_at: string }[]) {
      const n = counts[row.id] ?? 0;
      const ageMs = now - new Date(row.created_at).getTime();
      if (n === 0 && ageMs > GRACE_MS) closed.push(row.id);
    }
    if (closed.length) await sb.from("voice_rooms").update({ status: "closed" }).in("id", closed);
  } catch {
    /* counts still useful even if reconciliation fails */
  }

  return json({ counts, closed });
});
