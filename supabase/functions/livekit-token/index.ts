// Supabase Edge Function: livekit-token
//
// Mints a short-lived LiveKit access token for a Drop-in Room. The LiveKit
// API key/secret live only here as function secrets — never in the browser.
//
// Deploy:
//   supabase secrets set LIVEKIT_API_KEY=...  LIVEKIT_API_SECRET=...
//   supabase functions deploy livekit-token

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AccessToken } from "npm:livekit-server-sdk@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("LIVEKIT_API_KEY");
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  if (!apiKey || !apiSecret) return json({ error: "LiveKit credentials are not configured." }, 500);

  let body: { room?: string; identity?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const room = (body.room ?? "").trim();
  const identity = (body.identity ?? "").trim();
  if (!room || !identity) return json({ error: "room and identity are required." }, 400);

  const at = new AccessToken(apiKey, apiSecret, { identity, name: body.name ?? undefined, ttl: "2h" });
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
  const token = await at.toJwt();

  return json({ token });
});
