import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export type MatchStatus = "waiting" | "active" | "done" | "declined";
export type Turn = "host" | "opp";

export interface MatchRow {
  id: string;
  game_id: string;
  host_id: string;
  opponent_id: string | null;
  state: Record<string, unknown>;
  status: MatchStatus;
  score: Record<string, unknown>;
  created_at: string;
}

// Untyped supabase handle — the generated types.ts is owned elsewhere and may
// not yet describe these columns, so we cast at the boundary.
const db = supabase as any;

/**
 * Create a new match invite. Returns the inserted row (or null on failure).
 */
export function useCreateMatch() {
  const { user } = useAuth();

  return useCallback(
    async (
      gameId: string,
      opponentId: string,
      initialState: Record<string, unknown>,
    ): Promise<MatchRow | null> => {
      if (!user) return null;
      const { data, error } = await db
        .from("game_matches")
        .insert({
          game_id: gameId,
          host_id: user.id,
          opponent_id: opponentId,
          status: "waiting",
          state: initialState,
          score: {},
        })
        .select()
        .single();
      if (error) return null;
      return data as MatchRow;
    },
    [user],
  );
}

/**
 * Incoming invites where I am the opponent and the match is still waiting.
 * Subscribes to realtime changes filtered on my opponent_id.
 */
export function useIncomingInvites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["match-invites", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MatchRow[]> => {
      if (!user) return [];
      const { data } = await db
        .from("game_matches")
        .select("*")
        .eq("opponent_id", user.id)
        .eq("status", "waiting")
        .order("created_at", { ascending: false });
      return (data ?? []) as MatchRow[];
    },
    staleTime: 5_000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("match-invites-" + user.id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_matches",
          filter: `opponent_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["match-invites", user.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const accept = useCallback(async (matchId: string) => {
    await db.from("game_matches").update({ status: "active" }).eq("id", matchId);
  }, []);

  const decline = useCallback(async (matchId: string) => {
    await db.from("game_matches").update({ status: "declined" }).eq("id", matchId);
  }, []);

  return { invites: query.data ?? [], accept, decline };
}

/**
 * Live subscription to a single match row, plus presence so each side knows
 * whether their opponent is still connected. Returns the synced row, an
 * `update(patch)` writer, and `opponentPresent` / `opponentId`.
 */
export function useMatchChannel(matchId: string | null, userId: string) {
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [presentIds, setPresentIds] = useState<string[]>([]);

  useEffect(() => {
    if (!matchId || !userId) {
      setMatch(null);
      setPresentIds([]);
      return;
    }
    let active = true;

    // Initial fetch.
    db.from("game_matches")
      .select("*")
      .eq("id", matchId)
      .single()
      .then(({ data }: { data: MatchRow | null }) => {
        if (active && data) setMatch(data);
      });

    const channel = supabase.channel("match-" + matchId, {
      config: { presence: { key: userId } },
    });

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_matches",
          filter: `id=eq.${matchId}`,
        },
        ((payload: { new: MatchRow }) => {
          if (active && payload.new) setMatch(payload.new);
        }) as any,
      )
      .on("presence", { event: "sync" }, () => {
        const st = channel.presenceState() as Record<string, Array<{ user_id?: string }>>;
        const ids = Object.values(st)
          .flat()
          .map((p) => p.user_id)
          .filter((v): v is string => !!v);
        if (active) setPresentIds(ids);
      })
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") void channel.track({ user_id: userId });
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [matchId, userId]);

  const update = useCallback(
    async (patch: Partial<Pick<MatchRow, "state" | "status" | "score">>) => {
      if (!matchId) return;
      // Optimistically apply locally so the acting player sees it instantly.
      setMatch((prev) => (prev ? { ...prev, ...patch } : prev));
      await db.from("game_matches").update(patch).eq("id", matchId);
    },
    [matchId],
  );

  const opponentId = match ? (match.host_id === userId ? match.opponent_id : match.host_id) : null;
  const opponentPresent = !!opponentId && presentIds.includes(opponentId);

  return { match, update, opponentPresent, opponentId };
}

/**
 * Insert a single win row for the winner. Safe to call once when a match ends.
 */
export async function submitWin(gameKey: string, winnerId: string) {
  await db.from("game_scores").insert({
    game_key: gameKey,
    user_id: winnerId,
    score: 1,
    detail: {},
  });
}
