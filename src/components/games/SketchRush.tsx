import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MatchLobby from "./MatchLobby";
import MatchShell from "./MatchShell";
import { useMatchChannel, type MatchRow } from "./useMatch";

// The secret word is NOT stored in the shared match row. The server picks it
// (sketch_set_word) and only releases it to the drawer, or to everyone once a
// correct guess reveals it (sketch_word). Clients never see it in `state`.
interface SketchState {
  guesses: string[];
  drawerIsHost: boolean;
  round: number;
}

const newState = (): Record<string, unknown> =>
  ({ guesses: [], drawerIsHost: true, round: 0 }) as unknown as Record<string, unknown>;

const makeRematch = (prev: Record<string, unknown>): Record<string, unknown> => {
  const p = prev as unknown as SketchState;
  return {
    guesses: [],
    drawerIsHost: !p.drawerIsHost, // swap who draws
    round: Number(p.round ?? 0) + 1,
  } as unknown as Record<string, unknown>;
};

const CANVAS_W = 360;
const CANVAS_H = 280;

export default function SketchRush({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const [matchId, setMatchId] = useState<string | null>(null);

  if (!matchId) {
    return (
      <MatchLobby gameId={gameId} initialState={newState()} onEnter={(m: MatchRow) => setMatchId(m.id)} />
    );
  }
  return <SketchGame matchId={matchId} userId={user?.id ?? ""} onLeave={() => setMatchId(null)} />;
}

function SketchGame({ matchId, userId, onLeave }: { matchId: string; userId: string; onLeave: () => void }) {
  const { match, update, opponentPresent, opponentId } = useMatchChannel(matchId, userId);
  const [revealWord, setRevealWord] = useState<string>("");

  // When the round ends, fetch the (now-revealed) word so the result screen
  // can show it — MatchShell unmounts the play surface at "done".
  useEffect(() => {
    if (match?.status !== "done") {
      setRevealWord("");
      return;
    }
    let active = true;
    void (async () => {
      const { data } = await (supabase as any).rpc("sketch_word", { p_match: matchId });
      if (active && typeof data === "string") setRevealWord(data);
    })();
    return () => {
      active = false;
    };
  }, [match?.status, matchId]);

  return (
    <MatchShell
      match={match}
      update={update}
      userId={userId}
      opponentId={opponentId}
      opponentPresent={opponentPresent}
      gameKey="sketch-rush"
      makeRematch={makeRematch}
      onLeave={onLeave}
      resultDetail={revealWord ? <>The word was <span className="text-foreground font-medium">{revealWord}</span></> : undefined}
    >
      {() => <SketchActive match={match!} update={update} userId={userId} />}
    </MatchShell>
  );
}

interface StrokePoint { x: number; y: number; start: boolean }

function SketchActive({
  match,
  update,
  userId,
}: {
  match: MatchRow;
  update: (p: Partial<Pick<MatchRow, "state" | "status" | "score">>) => Promise<void>;
  userId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const wordSet = useRef(false);
  const [guess, setGuess] = useState("");
  const [word, setWord] = useState<string>("");

  const state = match.state as unknown as SketchState;
  const isHost = match.host_id === userId;
  const isDrawer = state.drawerIsHost ? isHost : !isHost;
  const guesserId = state.drawerIsHost ? match.opponent_id : match.host_id;

  // The drawer seeds a fresh word on the server when entering a round (initial
  // match and each rematch), then fetches it back to draw. The guesser fetches
  // too but receives null until the word is revealed by a correct guess.
  // Keyed on round so a rematch re-seeds and re-fetches a fresh word.
  useEffect(() => {
    let active = true;
    wordSet.current = false;
    setWord("");

    const run = async () => {
      if (isDrawer) {
        await (supabase as any).rpc("sketch_set_word", { p_match: match.id });
        wordSet.current = true;
      }
      const { data } = await (supabase as any).rpc("sketch_word", { p_match: match.id });
      if (active && typeof data === "string") setWord(data);
    };
    void run();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, state.round, isDrawer]);

  const ctx = () => canvasRef.current?.getContext("2d") ?? null;

  const drawPoint = (p: StrokePoint, broadcast: boolean) => {
    const c = ctx();
    if (!c) return;
    if (p.start) {
      c.beginPath();
      c.moveTo(p.x, p.y);
    } else {
      c.lineTo(p.x, p.y);
      c.strokeStyle = "#e5e7eb";
      c.lineWidth = 3;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.stroke();
    }
    if (broadcast) channelRef.current?.send({ type: "broadcast", event: "stroke", payload: p });
  };

  const clearCanvas = () => {
    const c = ctx();
    const canvas = canvasRef.current;
    if (c && canvas) c.clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawSnapshot = (url: string) => {
    const c = ctx();
    if (!c || !url) return;
    const img = new Image();
    img.onload = () => c.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
    img.src = url;
  };

  const sendSnapshot = () => {
    const url = canvasRef.current?.toDataURL("image/png");
    if (url) channelRef.current?.send({ type: "broadcast", event: "snapshot", payload: { url } });
  };

  // Stroke/snapshot broadcast channel (separate from the match presence channel).
  useEffect(() => {
    const channel = supabase.channel("sketch-" + match.id, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "stroke" }, ({ payload }: { payload: StrokePoint }) => drawPoint(payload, false))
      .on("broadcast", { event: "clear" }, () => clearCanvas())
      .on("broadcast", { event: "snapshot" }, ({ payload }: { payload: { url: string } }) => drawSnapshot(payload.url))
      .on("broadcast", { event: "sync-request" }, () => {
        if (isDrawer) sendSnapshot(); // drawer answers a late joiner with the current canvas
      })
      .subscribe((status: string) => {
        // A guesser entering (or re-entering) asks the drawer for the current canvas.
        if (status === "SUBSCRIBED" && !isDrawer) channel.send({ type: "broadcast", event: "sync-request", payload: {} });
      });
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, isDrawer]);

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;
    drawing.current = true;
    const { x, y } = pointFromEvent(e);
    drawPoint({ x, y, start: true }, true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !drawing.current) return;
    const { x, y } = pointFromEvent(e);
    drawPoint({ x, y, start: false }, true);
  };
  const onPointerUp = () => {
    if (!isDrawer || !drawing.current) return;
    drawing.current = false;
    sendSnapshot(); // keep late joiners / reconnects in sync
  };

  const clearAll = () => {
    clearCanvas();
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
  };

  const submitGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDrawer) return;
    const g = guess.trim().toLowerCase();
    setGuess("");
    if (!g) return;

    // The server judges the guess; the word never reaches the guesser's client
    // until a correct guess reveals it server-side.
    const { data: correct } = await (supabase as any).rpc("sketch_guess", {
      p_match: match.id,
      p_guess: g,
    });

    const guesses = [...state.guesses, g];

    if (correct === true) {
      // The word is now revealed server-side — fetch it so we can show it.
      const { data: revealed } = await (supabase as any).rpc("sketch_word", { p_match: match.id });
      if (typeof revealed === "string") setWord(revealed);
      await update({
        state: { ...state, guesses } as unknown as Record<string, unknown>,
        status: "done",
        score: { winner: guesserId ?? undefined } as Record<string, unknown>,
      });
    } else {
      await update({
        state: { ...state, guesses } as unknown as Record<string, unknown>,
      });
    }
  };

  // Once the round is over, the guesser can fetch the now-revealed word to show
  // "the word was X" (the drawer already holds it).
  const roundOver = match.status === "done";

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="flex items-center justify-between text-sm">
        {isDrawer ? (
          <span className="text-primary font-medium">
            Draw: <span className="uppercase tracking-wide">{word}</span>
          </span>
        ) : roundOver && word ? (
          <span className="text-muted-foreground">
            The word was <span className="uppercase tracking-wide text-primary">{word}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Guess what they're drawing!</span>
        )}
        {isDrawer && (
          <Button variant="ghost" size="icon" onClick={clearAll} title="Clear">
            <Eraser className="w-4 h-4" />
          </Button>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className={`w-full rounded-2xl border border-border/30 bg-[#0b0f14] ${
          isDrawer ? "cursor-crosshair touch-none" : "pointer-events-none"
        }`}
        style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      />

      {!isDrawer && !roundOver && (
        <form onSubmit={submitGuess} className="flex gap-2">
          <Input
            autoFocus
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Your guess"
            className="bg-card/60 border-border/30"
          />
          <Button type="submit">Guess</Button>
        </form>
      )}

      {state.guesses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {state.guesses.map((g, i) => (
            <span key={i} className="rounded-lg bg-card px-2 py-0.5 text-xs text-muted-foreground">{g}</span>
          ))}
        </div>
      )}
    </div>
  );
}
