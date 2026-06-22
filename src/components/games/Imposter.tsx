import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  VenetianMask,
  Users,
  Vote,
  Eye,
  EyeOff,
  Crown,
  Loader2,
  LogOut,
  Play,
  Plus,
  DoorOpen,
  RefreshCw,
  Check,
  Trophy,
  Skull,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useTeam, initials } from "@/hooks/useTeam";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import GameLeaderboard from "@/components/GameLeaderboard";

// Untyped supabase handle — the generated types may not describe these columns
// or RPCs, so we cast at the query boundary (same pattern as useMatch.ts).
const db = supabase as any;

const GAME_KEY = "imposter";

// ── Types ──────────────────────────────────────────────────────────────
type Phase = "lobby" | "clues" | "vote" | "reveal";
type Role = "crew" | "imposter";

interface Player {
  id: string;
  name: string;
}

interface Clue {
  playerId: string;
  word: string;
}

// The authoritative, broadcast + persisted game state. It deliberately holds
// NO secret: the word, the per-player roles, and the imposter id all live
// server-side and are fetched per-client via RPCs (imposter_my_role /
// imposter_truth). This means a client can never read another player's role.
interface GameState {
  phase: Phase;
  players: Player[];
  turnIndex: number;
  clues: Clue[];
  votes: Record<string, string>; // voterId -> suspectId
  round: number;
}

// Action messages non-hosts send; only the effective host applies them.
type Action =
  | { type: "clue"; playerId: string; word: string }
  | { type: "vote"; voterId: string; suspectId: string };

interface MatchRow {
  id: string;
  game_id: string;
  host_id: string;
  status: "waiting" | "active" | "done" | "declined";
  created_at: string;
}

// What imposter_my_role returns, plus the round it was fetched for.
interface MyRole {
  role: Role;
  word: string | null;
  round: number;
}

// What imposter_truth returns once the host has revealed.
interface Truth {
  word: string;
  imposters: string[];
}

const emptyState = (): GameState => ({
  phase: "lobby",
  players: [],
  turnIndex: 0,
  clues: [],
  votes: {},
  round: 0,
});

const isPlayingPhase = (p: Phase) => p === "clues" || p === "vote" || p === "reveal";

// ── Top-level dispatcher: lobby vs in-room ──────────────────────────────
export default function Imposter({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const [room, setRoom] = useState<{ id: string; hostId: string } | null>(null);

  if (!user) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Sign in to play.
      </div>
    );
  }

  if (!room) {
    return (
      <Lobby
        gameId={gameId}
        onEnter={(id, hostId) => setRoom({ id, hostId })}
      />
    );
  }

  return (
    <Room
      roomId={room.id}
      hostId={room.hostId}
      userId={user.id}
      gameId={gameId}
      onLeave={() => setRoom(null)}
    />
  );
}

// ── Lobby: list of open rooms + create ──────────────────────────────────
function Lobby({
  gameId,
  onEnter,
}: {
  gameId: string;
  onEnter: (roomId: string, hostId: string) => void;
}) {
  const { user, profile } = useAuth();
  const { data: team } = useTeam();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: rooms } = useQuery({
    queryKey: ["imposter-rooms", gameId],
    queryFn: async (): Promise<MatchRow[]> => {
      const { data } = await db
        .from("game_matches")
        .select("*")
        .eq("game_id", gameId)
        .eq("status", "waiting")
        .order("created_at", { ascending: false });
      return (data ?? []) as MatchRow[];
    },
    refetchInterval: 5_000,
    staleTime: 3_000,
  });

  // Refresh the room list whenever a row for this game changes.
  useEffect(() => {
    const channel = supabase
      .channel("imposter-lobby-" + gameId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_matches",
          filter: `game_id=eq.${gameId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["imposter-rooms", gameId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, queryClient]);

  const nameFor = useCallback(
    (id: string) => {
      if (id === user?.id) return profile?.name ?? "You";
      return team?.find((t) => t.id === id)?.name ?? "A teammate";
    },
    [team, user?.id, profile?.name],
  );

  const avatarFor = useCallback(
    (id: string) => team?.find((t) => t.id === id)?.avatar_url ?? null,
    [team],
  );

  const createRoom = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await db
      .from("game_matches")
      .insert({
        game_id: gameId,
        host_id: user.id,
        opponent_id: null,
        status: "waiting",
        state: {},
        score: {},
      })
      .select()
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error("Couldn't create a room. Try again.");
      return;
    }
    onEnter((data as MatchRow).id, (data as MatchRow).host_id);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/30 bg-card/60 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-violet-500/15 p-2.5">
            <VenetianMask className="w-6 h-6 text-violet-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base font-semibold text-foreground">Imposter</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              4+ players. Everyone gets the secret word except the imposter(s). Give one-word
              clues, then vote out the imposter.
            </p>
          </div>
        </div>
        <Button className="mt-4 w-full sm:w-auto" onClick={createRoom} disabled={creating}>
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create a room
        </Button>
      </div>

      <div className="rounded-2xl border border-border/30 bg-card/60 p-4">
        <h4 className="text-sm font-display font-semibold text-foreground mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          Open rooms
        </h4>
        {rooms && rooms.length > 0 ? (
          <div className="space-y-2">
            {rooms.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl bg-card/60 px-3 py-2 border border-border/20"
              >
                <Avatar className="w-8 h-8 ring-1 ring-border/30">
                  <AvatarImage src={avatarFor(r.host_id) ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                    {initials(nameFor(r.host_id))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">
                    {nameFor(r.host_id)}&apos;s room
                  </p>
                  <p className="text-[11px] text-muted-foreground">Waiting for players</p>
                </div>
                <Button size="sm" onClick={() => onEnter(r.id, r.host_id)}>
                  <DoorOpen className="w-4 h-4" /> Join
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No open rooms. Create one and rally the team.
          </p>
        )}
      </div>

      <GameLeaderboard gameKey={GAME_KEY} />
    </div>
  );
}

// ── Room: presence + broadcast game ─────────────────────────────────────
function Room({
  roomId,
  hostId,
  userId,
  gameId,
  onLeave,
}: {
  roomId: string;
  hostId: string; // the DB host_id (original creator)
  userId: string;
  gameId: string;
  onLeave: () => void;
}) {
  const { profile } = useAuth();
  const { data: team } = useTeam();
  const queryClient = useQueryClient();

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Presence-tracked players (deduped by user_id), and connection state.
  const [presence, setPresence] = useState<Player[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);

  // The DB host_id stays fixed. The *effective* host is computed from presence:
  // if the DB host is present they host; otherwise the present participant with
  // the lexicographically-smallest user_id is promoted. Derived, not in the DB.
  const [effectiveHostId, setEffectiveHostId] = useState<string>(hostId);
  const effectiveHostRef = useRef<string>(hostId);
  useEffect(() => {
    effectiveHostRef.current = effectiveHostId;
  }, [effectiveHostId]);
  const isHost = userId === effectiveHostId;
  const isDbHost = userId === hostId;

  // True once we've loaded the persisted row from the DB at mount, so we don't
  // clobber DB state with the empty initial state before reconciliation.
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  // The effective host holds the canonical state and broadcasts + persists it.
  // Non-hosts mirror the last received state. A ref stays in sync so channel
  // callbacks read the freshest state without re-subscribing.
  const [state, setState] = useState<GameState>(emptyState);
  const stateRef = useRef<GameState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // The caller's OWN role for the current round (fetched via imposter_my_role).
  // Never broadcast — each client learns only its own role.
  const [myRole, setMyRole] = useState<MyRole | null>(null);
  const myRoleFetchRef = useRef<number>(-1); // round we last fetched a role for

  // The full truth (word + imposter), fetched via imposter_truth in reveal.
  const [truth, setTruth] = useState<Truth | null>(null);
  const truthFetchRef = useRef<number>(-1); // round we last fetched truth for
  const revealedRoundRef = useRef<number>(-1); // round the host has flipped to revealed

  const scoredRoundRef = useRef<number>(-1);

  // Host's chosen number of imposters. Only meaningful when more than 7 players
  // are present; the server forces 1 otherwise. Default 1.
  const [imposterCount, setImposterCount] = useState<1 | 2>(1);

  const myName = profile?.name ?? "Player";

  const avatarFor = useCallback(
    (id: string) => team?.find((t) => t.id === id)?.avatar_url ?? null,
    [team],
  );

  // ── Server RPC helpers ───────────────────────────────────────────────
  // Fetch (only) my own role for a round. Safe for every client to call.
  const fetchMyRole = useCallback(
    async (round: number) => {
      if (myRoleFetchRef.current === round) return;
      myRoleFetchRef.current = round;
      const { data, error } = await db.rpc("imposter_my_role", { p_match: roomId });
      if (error || !data) {
        // Allow a retry on the next trigger if the deal hasn't landed yet.
        myRoleFetchRef.current = -1;
        return;
      }
      setMyRole({ role: data.role as Role, word: data.word ?? null, round });
    },
    [roomId],
  );

  // Fetch the full truth once any host has revealed. Safe for every client.
  const fetchTruth = useCallback(
    async (round: number) => {
      if (truthFetchRef.current === round) return;
      const { data, error } = await db.rpc("imposter_truth", { p_match: roomId });
      if (error || !data) return; // not revealed yet — retry on next trigger
      truthFetchRef.current = round;
      setTruth({ word: data.word as string, imposters: (data.imposters ?? []) as string[] });
    },
    [roomId],
  );

  // ── Broadcast + persist ──────────────────────────────────────────────
  const broadcastState = useCallback((s: GameState) => {
    channelRef.current?.send({ type: "broadcast", event: "state", payload: s });
  }, []);

  // Persist the authoritative state to the DB. Allowed for the host OR any
  // listed participant, so a migrated (effective) host can write too.
  const persistState = useCallback(
    (s: GameState) => {
      void db.rpc("match_set_state", { p_match: roomId, p_state: s }).then(() => {});
    },
    [roomId],
  );

  // Effective host: set state locally, broadcast, AND persist in one step.
  const pushState = useCallback(
    (next: GameState) => {
      stateRef.current = next;
      setState(next);
      broadcastState(next);
      persistState(next);
    },
    [broadcastState, persistState],
  );

  // ── Mount: hydrate persisted state from the DB (source of truth at mount) ──
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await db
        .from("game_matches")
        .select("state, status, host_id")
        .eq("id", roomId)
        .single();
      if (cancelled) return;
      if (data?.status === "done") {
        setRoomClosed(true);
        return;
      }
      const persisted = data?.state as Partial<GameState> | null | undefined;
      if (persisted && typeof persisted.phase === "string") {
        const seeded: GameState = {
          phase: persisted.phase as Phase,
          players: persisted.players ?? [],
          turnIndex: persisted.turnIndex ?? 0,
          clues: persisted.clues ?? [],
          votes: persisted.votes ?? {},
          round: persisted.round ?? 0,
        };
        stateRef.current = seeded;
        setState(seeded);
        // Mid-round refresher: re-learn our own role from the server.
        if (isPlayingPhase(seeded.phase) && seeded.round > 0) {
          void fetchMyRole(seeded.round);
          if (seeded.phase === "reveal") void fetchTruth(seeded.round);
        }
      }
      hydratedRef.current = true;
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ── Deal a fresh round (effective host, requires being the DB host) ──────
  // imposter_deal requires the DB host. We build the public state locally and
  // ask the server to pick + store the secret word/imposter privately.
  const startRound = useCallback(
    async (players: Player[], round: number, imposters: 1 | 2) => {
      // Public state is broadcast/persisted; the secret never enters it.
      const next: GameState = {
        phase: "clues",
        players,
        turnIndex: 0,
        clues: [],
        votes: {},
        round,
      };
      // Reset our role/truth fetch trackers for the new round.
      myRoleFetchRef.current = -1;
      truthFetchRef.current = -1;
      revealedRoundRef.current = -1;
      setMyRole(null);
      setTruth(null);

      // Server-side deal (DB host only). If we are not the DB host we cannot
      // deal; we still progress the round publicly (pragmatic — see notes).
      if (isDbHost) {
        const { error } = await db.rpc("imposter_deal", {
          p_match: roomId,
          p_players: players.map((p) => p.id),
          p_imposters: imposters,
        });
        if (error) {
          toast.error("Couldn't deal roles. Try again.");
          return;
        }
      }
      pushState(next);
      // Everyone (including us) learns their own role.
      void fetchMyRole(round);
    },
    [isDbHost, roomId, pushState, fetchMyRole],
  );

  // ── Channel lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel("imposter-" + roomId, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const raw = channel.presenceState() as Record<
          string,
          Array<{ user_id?: string; name?: string }>
        >;
        const seen = new Map<string, Player>();
        for (const entries of Object.values(raw)) {
          for (const e of entries) {
            if (e.user_id && !seen.has(e.user_id)) {
              seen.set(e.user_id, { id: e.user_id, name: e.name ?? "Player" });
            }
          }
        }
        const players = [...seen.values()];
        setPresence(players);

        // Compute the effective host from presence.
        let nextHost: string | null;
        if (seen.has(hostId)) {
          nextHost = hostId; // original host present → they host
        } else if (players.length > 0) {
          // Promote the lexicographically-smallest present user_id.
          nextHost = players.map((p) => p.id).sort()[0];
        } else {
          nextHost = null; // nobody present (transient) — keep prior
        }

        if (nextHost && nextHost !== effectiveHostRef.current) {
          const wasHost = effectiveHostRef.current === userId;
          const becomingHost = nextHost === userId;
          effectiveHostRef.current = nextHost;
          setEffectiveHostId(nextHost);
          // Only surface migration once we've actually lost the original host.
          if (!seen.has(hostId) && !wasHost) {
            toast.message("Host changed");
          }
          // A freshly-promoted host re-asserts authority by re-broadcasting and
          // re-persisting the current state so the round keeps moving.
          if (becomingHost && !wasHost) {
            const s = stateRef.current;
            broadcastState(s);
            persistState(s);
          }
        }
      })
      // Everyone receives canonical state from the effective host.
      .on("broadcast", { event: "state" }, ({ payload }: { payload: GameState }) => {
        if (effectiveHostRef.current === userId) return; // I'm the host; ignore
        stateRef.current = payload;
        setState(payload);
        // Mirror role/truth fetches off received phase transitions.
        if (isPlayingPhase(payload.phase) && payload.round > 0) {
          void fetchMyRole(payload.round);
          if (payload.phase === "reveal") void fetchTruth(payload.round);
        }
      })
      // Late joiner asks the effective host to resend the current state.
      .on("broadcast", { event: "sync" }, () => {
        if (effectiveHostRef.current !== userId) return;
        broadcastState(stateRef.current);
      })
      // Effective host: apply player actions to the canonical state.
      .on("broadcast", { event: "action" }, (({ payload }: { payload: Action }) => {
        if (effectiveHostRef.current !== userId) return;
        const s = stateRef.current;
        if (payload.type === "clue") {
          if (s.phase !== "clues") return;
          const current = s.players[s.turnIndex];
          if (!current || current.id !== payload.playerId) return; // not their turn
          const word = payload.word.trim().split(/\s+/)[0] ?? "";
          if (!word) return;
          const clues = [...s.clues, { playerId: payload.playerId, word }];
          const nextTurn = s.turnIndex + 1;
          const done = nextTurn >= s.players.length;
          pushState({
            ...s,
            clues,
            turnIndex: done ? s.turnIndex : nextTurn,
            phase: done ? "vote" : "clues",
          });
        } else if (payload.type === "vote") {
          if (s.phase !== "vote") return;
          if (payload.voterId === payload.suspectId) return; // no self-vote
          if (!s.players.some((p) => p.id === payload.voterId)) return;
          const votes = { ...s.votes, [payload.voterId]: payload.suspectId };
          const allVoted = s.players.every((p) => votes[p.id]);
          pushState({ ...s, votes, phase: allVoted ? "reveal" : "vote" });
        }
      }) as any)
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setSubscribed(true);
          void channel.track({ user_id: userId, name: myName });
          // Ask the effective host to resend current state (covers late joiners
          // and refreshers reconciling against the live host).
          channel.send({ type: "broadcast", event: "sync", payload: { from: userId } });
        }
      });

    return () => {
      setSubscribed(false);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, hostId, myName]);

  // Effective host: during the lobby, keep canonical players mirroring presence.
  useEffect(() => {
    if (!isHost) return;
    if (!hydratedRef.current) return;
    if (stateRef.current.phase !== "lobby") return;
    const s = stateRef.current;
    const sameLength = s.players.length === presence.length;
    const sameIds = sameLength && s.players.every((p, i) => p.id === presence[i]?.id);
    if (!sameIds) {
      pushState({ ...s, players: presence });
    }
  }, [isHost, presence, hydrated, pushState]);

  // ── Host actions ─────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    if (!isHost) return;
    if (presence.length < 4) return;
    // Only allow 2 imposters when more than 7 players are present.
    const imposters: 1 | 2 = presence.length > 7 ? imposterCount : 1;
    void startRound(presence, 1, imposters);
    void db.from("game_matches").update({ status: "active" }).eq("id", roomId);
  }, [isHost, presence, startRound, roomId, imposterCount]);

  const playAgain = useCallback(() => {
    if (!isHost) return;
    // Reuse currently present players so leavers don't break a new round.
    const players = presence.length >= 4 ? presence : stateRef.current.players;
    if (players.length < 4) {
      toast.error("Need at least 4 players for another round.");
      return;
    }
    const imposters: 1 | 2 = players.length > 7 ? imposterCount : 1;
    void startRound(players, stateRef.current.round + 1, imposters);
  }, [isHost, presence, startRound, imposterCount]);

  const leave = useCallback(() => {
    // Only the DB host (when still present) closes the room; an effective host
    // promoted by migration should not destroy the original host's room.
    if (isDbHost) {
      void db.from("game_matches").update({ status: "done" }).eq("id", roomId);
    }
    onLeave();
  }, [isDbHost, roomId, onLeave]);

  // ── Non-host actions ─────────────────────────────────────────────────
  const sendClue = useCallback(
    (word: string) => {
      const action: Action = { type: "clue", playerId: userId, word };
      if (isHost) {
        const s = stateRef.current;
        if (s.phase !== "clues") return;
        const current = s.players[s.turnIndex];
        if (!current || current.id !== userId) return;
        const w = word.trim().split(/\s+/)[0] ?? "";
        if (!w) return;
        const clues = [...s.clues, { playerId: userId, word: w }];
        const nextTurn = s.turnIndex + 1;
        const done = nextTurn >= s.players.length;
        pushState({
          ...s,
          clues,
          turnIndex: done ? s.turnIndex : nextTurn,
          phase: done ? "vote" : "clues",
        });
      } else {
        channelRef.current?.send({ type: "broadcast", event: "action", payload: action });
      }
    },
    [isHost, userId, pushState],
  );

  const sendVote = useCallback(
    (suspectId: string) => {
      if (suspectId === userId) return;
      const action: Action = { type: "vote", voterId: userId, suspectId };
      if (isHost) {
        const s = stateRef.current;
        if (s.phase !== "vote") return;
        const votes = { ...s.votes, [userId]: suspectId };
        const allVoted = s.players.every((p) => votes[p.id]);
        pushState({ ...s, votes, phase: allVoted ? "reveal" : "vote" });
      } else {
        channelRef.current?.send({ type: "broadcast", event: "action", payload: action });
      }
    },
    [isHost, userId, pushState],
  );

  // ── Reveal: host flips the secret, everyone fetches the truth ──────────
  // When we enter the reveal phase: the effective host (if it's the DB host)
  // flips the server secret to "revealed"; then EVERY client fetches the truth.
  useEffect(() => {
    if (state.phase !== "reveal" || state.round <= 0) return;
    if (isDbHost && revealedRoundRef.current !== state.round) {
      revealedRoundRef.current = state.round;
      void (async () => {
        await db.rpc("imposter_reveal_now", { p_match: roomId });
        void fetchTruth(state.round);
      })();
    } else {
      // Non-DB-host (incl. migrated host): poll the truth until it's available.
      void fetchTruth(state.round);
    }
  }, [state.phase, state.round, isDbHost, roomId, fetchTruth]);

  // Retry fetching the truth a few times in reveal in case the reveal RPC
  // lands slightly after we first try (or a migrated host can't flip it but a
  // prior host already did).
  useEffect(() => {
    if (state.phase !== "reveal" || state.round <= 0) return;
    if (truth && truthFetchRef.current === state.round) return;
    const t = setInterval(() => {
      if (truthFetchRef.current === state.round) return;
      void fetchTruth(state.round);
    }, 1200);
    return () => clearInterval(t);
  }, [state.phase, state.round, truth, fetchTruth]);

  // ── Reveal tally + scoring ───────────────────────────────────────────
  // The tally is computed from the public votes plus the server truth (the
  // imposter id is no longer in client state).
  const tally = useMemo(() => {
    if (state.phase !== "reveal" || !truth) return null;
    const counts: Record<string, number> = {};
    for (const suspectId of Object.values(state.votes)) {
      counts[suspectId] = (counts[suspectId] ?? 0) + 1;
    }
    let max = 0;
    let ejectedId: string | null = null;
    let tie = false;
    for (const [id, c] of Object.entries(counts)) {
      if (c > max) {
        max = c;
        ejectedId = id;
        tie = false;
      } else if (c === max) {
        tie = true;
      }
    }
    const ejected = tie ? null : ejectedId;
    const imposterIds = truth.imposters;
    // Crew wins if the ejected player is one of the imposters; otherwise the
    // imposters win (including on a tie, where no one is ejected).
    const crewWins = !!ejected && imposterIds.includes(ejected);
    return { counts, ejected, imposterIds, crewWins, tie };
  }, [state.phase, state.votes, truth]);

  // Each client inserts its OWN win row once per round if on the winning side.
  // Our side is derived from our own role (myRole), not from shared state.
  useEffect(() => {
    if (state.phase !== "reveal" || !tally) return;
    if (scoredRoundRef.current === state.round) return;
    if (!myRole || myRole.round !== state.round) return; // role not loaded yet
    const iWon = tally.crewWins ? myRole.role === "crew" : myRole.role === "imposter";
    scoredRoundRef.current = state.round;
    if (!iWon) return;
    void (async () => {
      await db.from("game_scores").insert({
        game_key: GAME_KEY,
        user_id: userId,
        score: 1,
        detail: {},
      });
      queryClient.invalidateQueries({ queryKey: ["leaderboard", GAME_KEY] });
    })();
  }, [state.phase, state.round, tally, myRole, userId, queryClient]);

  // ── Room closed (no players remain / DB host closed it) ────────────────
  useEffect(() => {
    if (roomClosed) {
      const t = setTimeout(onLeave, 1500);
      return () => clearTimeout(t);
    }
  }, [roomClosed, onLeave]);

  // ── Render ───────────────────────────────────────────────────────────
  const nameFor = useCallback(
    (id: string) => {
      const fromState = state.players.find((p) => p.id === id)?.name;
      if (fromState) return fromState;
      return presence.find((p) => p.id === id)?.name ?? "Player";
    },
    [state.players, presence],
  );

  if (roomClosed) {
    return (
      <div className="py-16 text-center space-y-3">
        <DoorOpen className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Room closed.</p>
      </div>
    );
  }

  if (!subscribed || !hydrated) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-6 h-6 text-muted-foreground mx-auto animate-spin" />
        <p className="text-sm text-muted-foreground mt-3">Joining room…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <RoomHeader
        isHost={isHost}
        phase={state.phase}
        round={state.round}
        onLeave={leave}
      />

      <PlayerStrip
        players={presence}
        hostId={effectiveHostId}
        turnPlayerId={state.phase === "clues" ? state.players[state.turnIndex]?.id : undefined}
        votedIds={state.phase === "vote" ? Object.keys(state.votes) : []}
        avatarFor={avatarFor}
      />

      {state.phase === "lobby" && (
        <WaitingRoom
          isHost={isHost}
          count={presence.length}
          imposterCount={imposterCount}
          onImposterCountChange={setImposterCount}
          onStart={startGame}
        />
      )}

      {(state.phase === "clues" || state.phase === "vote") && (
        <RoleCard myRole={myRole} round={state.round} />
      )}

      {state.phase === "clues" && (
        <CluePhase
          state={state}
          userId={userId}
          nameFor={nameFor}
          onClue={sendClue}
        />
      )}

      {state.phase === "vote" && (
        <VotePhase
          state={state}
          userId={userId}
          nameFor={nameFor}
          avatarFor={avatarFor}
          onVote={sendVote}
        />
      )}

      {state.phase === "reveal" && (
        <RevealPhase
          state={state}
          tally={tally}
          truth={truth}
          myRole={myRole}
          userId={userId}
          nameFor={nameFor}
          isHost={isHost}
          onPlayAgain={playAgain}
          onLeave={leave}
        />
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────
function RoomHeader({
  isHost,
  phase,
  round,
  onLeave,
}: {
  isHost: boolean;
  phase: Phase;
  round: number;
  onLeave: () => void;
}) {
  const label =
    phase === "lobby"
      ? "Waiting room"
      : phase === "clues"
        ? "Clue phase"
        : phase === "vote"
          ? "Voting"
          : "Reveal";
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-xl bg-violet-500/15 p-2">
        <VenetianMask className="w-5 h-5 text-violet-300" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
          Imposter
          {isHost && <Crown className="w-3.5 h-3.5 text-amber-400" />}
        </h3>
        <p className="text-[11px] text-muted-foreground">
          {label}
          {round > 0 && ` · Round ${round}`}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onLeave}>
        <LogOut className="w-4 h-4" /> Leave
      </Button>
    </div>
  );
}

function PlayerStrip({
  players,
  hostId,
  turnPlayerId,
  votedIds,
  avatarFor,
}: {
  players: Player[];
  hostId: string;
  turnPlayerId?: string;
  votedIds: string[];
  avatarFor: (id: string) => string | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((p) => {
        const isTurn = turnPlayerId === p.id;
        const voted = votedIds.includes(p.id);
        return (
          <div
            key={p.id}
            className={`flex items-center gap-1.5 rounded-full border px-2 py-1 ${
              isTurn ? "border-primary/60 bg-primary/10" : "border-border/30 bg-card/60"
            }`}
          >
            <Avatar className="w-5 h-5 ring-1 ring-border/30">
              <AvatarImage src={avatarFor(p.id) ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-[8px]">
                {initials(p.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] text-foreground max-w-[6rem] truncate">{p.name}</span>
            {p.id === hostId && <Crown className="w-3 h-3 text-amber-400" />}
            {voted && <Check className="w-3 h-3 text-emerald-400" />}
          </div>
        );
      })}
    </div>
  );
}

function WaitingRoom({
  isHost,
  count,
  imposterCount,
  onImposterCountChange,
  onStart,
}: {
  isHost: boolean;
  count: number;
  imposterCount: 1 | 2;
  onImposterCountChange: (n: 1 | 2) => void;
  onStart: () => void;
}) {
  const ready = count >= 4;
  // Two imposters are only available when more than 7 players are present.
  const showImposterToggle = isHost && count > 7;
  return (
    <div className="rounded-2xl border border-border/30 bg-card/60 p-6 text-center space-y-4">
      <Users className="w-8 h-8 text-muted-foreground mx-auto" />
      <div>
        <p className="text-sm text-foreground font-medium">
          {count} {count === 1 ? "player" : "players"} in the room
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          {ready ? "Ready when the host is." : "Need at least 4 players to start."}
        </p>
      </div>
      {showImposterToggle && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Imposters</span>
          <div className="inline-flex rounded-full border border-border/30 bg-card/60 p-0.5">
            {([1, 2] as const).map((n) => {
              const active = imposterCount === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onImposterCountChange(n)}
                  className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {isHost ? (
        <Button onClick={onStart} disabled={!ready}>
          <Play className="w-4 h-4" /> Start game
        </Button>
      ) : (
        <p className="text-[11px] text-muted-foreground">Waiting for the host to start…</p>
      )}
    </div>
  );
}

function RoleCard({
  myRole,
  round,
}: {
  myRole: MyRole | null;
  round: number;
}) {
  const [revealed, setRevealed] = useState(false);

  // Re-hide the role each new round.
  useEffect(() => {
    setRevealed(false);
  }, [round]);

  if (!myRole || myRole.round !== round) {
    return (
      <div className="rounded-2xl border border-border/30 bg-card/60 p-4 text-center">
        <Loader2 className="w-4 h-4 text-muted-foreground mx-auto animate-spin" />
        <p className="text-[11px] text-muted-foreground mt-2">Receiving your role…</p>
      </div>
    );
  }

  const isImposter = myRole.role === "imposter";

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isImposter ? "border-rose-500/40 bg-rose-500/5" : "border-violet-500/30 bg-violet-500/5"
      }`}
    >
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className={`rounded-xl p-2 ${isImposter ? "bg-rose-500/15" : "bg-violet-500/15"}`}>
          {isImposter ? (
            <VenetianMask className="w-5 h-5 text-rose-300" />
          ) : (
            <Eye className="w-5 h-5 text-violet-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground">Your role (tap to hide/show)</p>
          {revealed ? (
            isImposter ? (
              <p className="text-sm font-medium text-rose-300">
                You are the IMPOSTER — blend in and figure out the word.
              </p>
            ) : (
              <p className="text-sm font-medium text-foreground">
                Secret word:{" "}
                <span className="uppercase tracking-wide text-primary">{myRole.word}</span>
              </p>
            )
          ) : (
            <p className="text-sm font-medium text-muted-foreground">Tap to reveal</p>
          )}
        </div>
        {revealed ? (
          <Eye className="w-4 h-4 text-muted-foreground" />
        ) : (
          <EyeOff className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}

function ClueList({
  clues,
  nameFor,
}: {
  clues: Clue[];
  nameFor: (id: string) => string;
}) {
  if (clues.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {clues.map((c, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-xl bg-card/60 border border-border/20 px-3 py-1.5"
        >
          <span className="text-[11px] text-muted-foreground w-24 truncate">{nameFor(c.playerId)}</span>
          <span className="text-sm text-foreground font-medium">{c.word}</span>
        </div>
      ))}
    </div>
  );
}

function CluePhase({
  state,
  userId,
  nameFor,
  onClue,
}: {
  state: GameState;
  userId: string;
  nameFor: (id: string) => string;
  onClue: (word: string) => void;
}) {
  const [word, setWord] = useState("");
  const current = state.players[state.turnIndex];
  const myTurn = current?.id === userId;
  const iHaveClued = state.clues.some((c) => c.playerId === userId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = word.trim().split(/\s+/)[0] ?? "";
    if (!w) {
      toast.error("Give a single-word clue.");
      return;
    }
    onClue(w);
    setWord("");
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/30 bg-card/60 p-3 text-center">
        {myTurn ? (
          <p className="text-sm text-primary font-medium">Your turn — give a one-word clue</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Waiting for <span className="text-foreground">{nameFor(current?.id ?? "")}</span> to clue…
          </p>
        )}
      </div>

      {myTurn && !iHaveClued && (
        <form onSubmit={submit} className="flex gap-2">
          <Input
            autoFocus
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="One word"
            className="bg-card/60 border-border/30"
          />
          <Button type="submit">Clue</Button>
        </form>
      )}

      <ClueList clues={state.clues} nameFor={nameFor} />
    </div>
  );
}

function VotePhase({
  state,
  userId,
  nameFor,
  avatarFor,
  onVote,
}: {
  state: GameState;
  userId: string;
  nameFor: (id: string) => string;
  avatarFor: (id: string) => string | null;
  onVote: (suspectId: string) => void;
}) {
  const myVote = state.votes[userId];
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/30 bg-card/60 p-3 text-center flex items-center justify-center gap-2">
        <Vote className="w-4 h-4 text-primary" />
        <p className="text-sm text-foreground font-medium">
          {myVote ? "Vote locked in. Waiting for the rest…" : "Vote out the imposter"}
        </p>
      </div>

      <ClueList clues={state.clues} nameFor={nameFor} />

      <div className="grid grid-cols-2 gap-2">
        {state.players
          .filter((p) => p.id !== userId)
          .map((p) => {
            const picked = myVote === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={!!myVote}
                onClick={() => onVote(p.id)}
                className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
                  picked
                    ? "border-primary bg-primary/10"
                    : "border-border/30 bg-card/60 hover:bg-card disabled:hover:bg-card/60"
                }`}
              >
                <Avatar className="w-7 h-7 ring-1 ring-border/30">
                  <AvatarImage src={avatarFor(p.id) ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                    {initials(p.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-foreground truncate flex-1">{p.name}</span>
                {picked && <Check className="w-4 h-4 text-primary" />}
              </button>
            );
          })}
      </div>
    </div>
  );
}

function RevealPhase({
  state,
  tally,
  truth,
  myRole,
  userId,
  nameFor,
  isHost,
  onPlayAgain,
  onLeave,
}: {
  state: GameState;
  tally: {
    counts: Record<string, number>;
    ejected: string | null;
    imposterIds: string[];
    crewWins: boolean;
    tie: boolean;
  } | null;
  truth: Truth | null;
  myRole: MyRole | null;
  userId: string;
  nameFor: (id: string) => string;
  isHost: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}) {
  // Until the server truth + tally are loaded, show a brief loading state.
  if (!tally || !truth) {
    return (
      <div className="rounded-2xl border border-border/30 bg-card/60 p-6 text-center space-y-3">
        <Loader2 className="w-5 h-5 text-muted-foreground mx-auto animate-spin" />
        <p className="text-sm text-muted-foreground">Revealing the result…</p>
      </div>
    );
  }

  const iWon = myRole
    ? tally.crewWins
      ? myRole.role === "crew"
      : myRole.role === "imposter"
    : false;

  // Resolve imposter names for the reveal line ("X" or "X and Y" / list).
  const imposterNames = tally.imposterIds.map((id) => nameFor(id));
  const multipleImposters = imposterNames.length > 1;
  const imposterNameList =
    imposterNames.length <= 1
      ? imposterNames[0] ?? ""
      : imposterNames.length === 2
        ? `${imposterNames[0]} and ${imposterNames[1]}`
        : `${imposterNames.slice(0, -1).join(", ")} and ${imposterNames[imposterNames.length - 1]}`;

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border p-5 text-center space-y-2 ${
          tally.crewWins
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-rose-500/40 bg-rose-500/5"
        }`}
      >
        {tally.crewWins ? (
          <Trophy className="w-8 h-8 text-emerald-400 mx-auto" />
        ) : (
          <Skull className="w-8 h-8 text-rose-400 mx-auto" />
        )}
        <p className="text-base font-display font-semibold text-foreground">
          {tally.crewWins
            ? "Crew wins!"
            : multipleImposters
              ? "Imposters win!"
              : "Imposter wins!"}
        </p>
        {tally.tie ? (
          <p className="text-[11px] text-muted-foreground">
            Vote tied — no one was ejected, so the {multipleImposters ? "imposters survive" : "imposter survives"}.
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {nameFor(tally.ejected ?? "")} was ejected.
          </p>
        )}
        {myRole && (
          <p className={`text-xs font-medium ${iWon ? "text-emerald-400" : "text-muted-foreground"}`}>
            {iWon ? "You scored a win." : "You're on the losing side this round."}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border/30 bg-card/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Secret word</span>
          <span className="text-sm uppercase tracking-wide text-primary font-medium">
            {truth.word}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            {multipleImposters ? "The imposters were" : "The imposter was"}
          </span>
          <span className="text-sm text-rose-300 font-medium text-right">
            {imposterNameList}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-border/30 bg-card/60 p-4">
        <h4 className="text-[11px] text-muted-foreground mb-2">Vote tally</h4>
        <div className="space-y-1.5">
          {state.players.map((p) => {
            const count = tally.counts[p.id] ?? 0;
            const isImposter = tally.imposterIds.includes(p.id);
            return (
              <div key={p.id} className="flex items-center gap-2">
                <span
                  className={`text-sm flex-1 truncate ${
                    isImposter ? "text-rose-300 font-medium" : "text-foreground"
                  }`}
                >
                  {nameFor(p.id)}
                  {isImposter && <span className="text-[10px] text-rose-300 ml-1.5">(imposter)</span>}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {count} {count === 1 ? "vote" : "votes"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {isHost ? (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onPlayAgain}>
            <RefreshCw className="w-4 h-4" /> Play again
          </Button>
          <Button variant="ghost" onClick={onLeave}>
            <LogOut className="w-4 h-4" /> Close room
          </Button>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground text-center">
          Waiting for the host to start another round…
        </p>
      )}
    </div>
  );
}
