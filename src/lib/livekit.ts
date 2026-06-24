import { supabase } from "./supabase";

/** Public LiveKit server URL (wss://…livekit.cloud). Safe in the browser. */
export const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL ?? "";

/**
 * Fetch a LiveKit access token for a room from the edge function. The LiveKit
 * key/secret never reach the browser — see supabase/functions/livekit-token.
 */
export async function fetchRoomToken(room: string, identity: string, name?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("livekit-token", { body: { room, identity, name } });
  if (error) {
    let message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) message = body.error;
      }
    } catch {
      /* keep error.message */
    }
    throw new Error(message || "Couldn't get a room token.");
  }
  const token = (data as { token?: string }).token;
  if (!token) throw new Error("No token returned.");
  return token;
}

export interface RoomActivity {
  /** roomId → live participant count (from LiveKit). */
  counts: Record<string, number>;
  /** room ids that were reconciled to 'closed' this call. */
  closed: string[];
}

/**
 * Live participant counts + stale-room cleanup, sourced from LiveKit.
 * Resolves to empty data (rather than throwing) if the function is missing
 * or LiveKit isn't configured, so the lobby still renders.
 */
export async function fetchRoomActivity(): Promise<RoomActivity> {
  try {
    const { data, error } = await supabase.functions.invoke("livekit-rooms", { body: {} });
    if (error || !data) return { counts: {}, closed: [] };
    const d = data as Partial<RoomActivity>;
    return { counts: d.counts ?? {}, closed: d.closed ?? [] };
  } catch {
    return { counts: {}, closed: [] };
  }
}
