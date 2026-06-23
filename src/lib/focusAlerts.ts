// Ephemeral "someone started a group focus session" alerts.
//
// Uses a Supabase Realtime broadcast channel (not the notifications table) so
// the heads-up is transient: it only reaches teammates who are in the app right
// now, shows as a short-lived toast, and leaves nothing behind. Deliberately
// lighter than a notification.

import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface FocusAlert {
  hostName: string;
  hostId: string;
  sessionId: string;
  durationMinutes: number;
}

type Listener = (alert: FocusAlert) => void;

const listeners = new Set<Listener>();
let channel: RealtimeChannel | null = null;

function ensureChannel(): RealtimeChannel {
  if (channel) return channel;
  channel = supabase.channel("focus-alerts");
  // Register the handler before subscribing so we don't miss events.
  channel.on("broadcast", { event: "session-started" }, ({ payload }) => {
    listeners.forEach((l) => l(payload as FocusAlert));
  });
  channel.subscribe();
  return channel;
}

/** Tell everyone online that a group session just opened. */
export function sendFocusAlert(alert: FocusAlert): void {
  ensureChannel().send({ type: "broadcast", event: "session-started", payload: alert });
}

/** Listen for group-session alerts. Returns an unsubscribe function. */
export function subscribeFocusAlerts(listener: Listener): () => void {
  ensureChannel();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
