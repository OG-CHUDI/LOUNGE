import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** A point stored as normalised fractions (0–1) of the board's width/height. */
export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  /** Hex colour, or null for the eraser (drawn as destination-out). */
  color: string | null;
  /** Brush size in normalised units (fraction of the smaller board dimension). */
  size: number;
  points: StrokePoint[];
}

export interface PresenceUser {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
}

interface UseBoardRealtimeArgs {
  boardId: string;
  me: PresenceUser;
  /** Called when a remote peer finishes a stroke. */
  onRemoteStroke: (stroke: Stroke) => void;
  /** Called when a remote peer clears the board. */
  onRemoteClear: () => void;
}

interface BoardRealtime {
  /** Currently-connected peers (including me), de-duped by user_id. */
  presence: PresenceUser[];
  /** Broadcast a completed stroke to peers. */
  broadcastStroke: (stroke: Stroke) => void;
  /** Broadcast a clear event to peers. */
  broadcastClear: () => void;
}

/**
 * Opens the `board:${boardId}` realtime channel: broadcasts/receives strokes and
 * clear events, and tracks presence so we can show who is currently on the board.
 *
 * Two transports deliver remote strokes:
 *  - Broadcast (low latency, fire-and-forget, unordered) for instant in-session
 *    live strokes.
 *  - postgres_changes INSERT on `canvas_strokes` (durable, ordered) so late
 *    joiners / refreshers / anyone who missed a broadcast still receive every
 *    persisted stroke.
 *
 * A stroke can arrive via both transports, so the consumer must dedupe by the
 * stroke's stable `id`.
 */
export function useBoardRealtime({
  boardId,
  me,
  onRemoteStroke,
  onRemoteClear,
}: UseBoardRealtimeArgs): BoardRealtime {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([me]);

  // Keep the latest callbacks/me in refs so the channel effect can stay keyed
  // only on boardId (we never want to tear the channel down mid-session).
  const onRemoteStrokeRef = useRef(onRemoteStroke);
  const onRemoteClearRef = useRef(onRemoteClear);
  const meRef = useRef(me);
  onRemoteStrokeRef.current = onRemoteStroke;
  onRemoteClearRef.current = onRemoteClear;
  meRef.current = me;

  useEffect(() => {
    const channel = supabase.channel(`board:${boardId}`, {
      config: { broadcast: { self: false }, presence: { key: meRef.current.user_id } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        onRemoteStrokeRef.current(payload as Stroke);
      })
      .on("broadcast", { event: "clear" }, () => {
        onRemoteClearRef.current();
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "canvas_strokes",
          filter: `board_id=eq.${boardId}`,
        },
        ({ new: row }) => {
          const stroke = (row as { stroke?: Stroke }).stroke;
          if (stroke) onRemoteStrokeRef.current(stroke);
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const seen = new Map<string, PresenceUser>();
        for (const entries of Object.values(state)) {
          for (const entry of entries) {
            if (entry.user_id) seen.set(entry.user_id, entry);
          }
        }
        // Always include myself even before my own track lands.
        seen.set(meRef.current.user_id, meRef.current);
        setPresence(Array.from(seen.values()));
      });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.track(meRef.current);
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId]);

  const broadcastStroke = (stroke: Stroke) => {
    channelRef.current?.send({ type: "broadcast", event: "stroke", payload: stroke });
  };

  const broadcastClear = () => {
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
  };

  return { presence, broadcastStroke, broadcastClear };
}
