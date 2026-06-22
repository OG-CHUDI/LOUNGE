import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import MatchLobby from "./MatchLobby";
import MatchShell from "./MatchShell";
import { useMatchChannel, type MatchRow, type Turn } from "./useMatch";

interface WLState {
  words: string[];
  turn: Turn;
  lastLetter: string | null;
  round: number;
}

const EMPTY: WLState = { words: [], turn: "host", lastLetter: null, round: 0 };
const TURN_SECONDS = 20;

const makeRematch = (prev: Record<string, unknown>): Record<string, unknown> => {
  const round = Number((prev as { round?: number }).round ?? 0) + 1;
  return { words: [], turn: round % 2 === 0 ? "host" : "opp", lastLetter: null, round } as unknown as Record<string, unknown>;
};

export default function WordLink({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const [matchId, setMatchId] = useState<string | null>(null);

  if (!matchId) {
    return (
      <MatchLobby
        gameId={gameId}
        initialState={EMPTY as unknown as Record<string, unknown>}
        onEnter={(m: MatchRow) => setMatchId(m.id)}
      />
    );
  }
  return <WLGame matchId={matchId} userId={user?.id ?? ""} onLeave={() => setMatchId(null)} />;
}

function WLGame({ matchId, userId, onLeave }: { matchId: string; userId: string; onLeave: () => void }) {
  const { match, update, opponentPresent, opponentId } = useMatchChannel(matchId, userId);

  return (
    <MatchShell
      match={match}
      update={update}
      userId={userId}
      opponentId={opponentId}
      opponentPresent={opponentPresent}
      gameKey="word-link"
      makeRematch={makeRematch}
      onLeave={onLeave}
    >
      {() => <WLActive match={match!} update={update} userId={userId} opponentId={opponentId} />}
    </MatchShell>
  );
}

function WLActive({
  match,
  update,
  userId,
  opponentId,
}: {
  match: MatchRow;
  update: (p: Partial<Pick<MatchRow, "state" | "status" | "score">>) => Promise<void>;
  userId: string;
  opponentId: string | null;
}) {
  const [guess, setGuess] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS);

  const state = (match.state as unknown as WLState) ?? EMPTY;
  const isHost = match.host_id === userId;
  const myTurn: Turn = isHost ? "host" : "opp";
  const isMyMove = state.turn === myTurn;

  // Per-turn countdown; on my own timeout the opponent wins.
  useEffect(() => {
    if (!isMyMove) {
      setSecondsLeft(TURN_SECONDS);
      return;
    }
    setSecondsLeft(TURN_SECONDS);
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          if (opponentId) {
            void update({ status: "done", score: { winner: opponentId } as Record<string, unknown> });
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isMyMove, state.words.length, opponentId, update]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMyMove) return;
    const w = guess.trim().toLowerCase();
    if (!w || !/^[a-z]+$/.test(w)) {
      toast.error("Letters only.");
      return;
    }
    if (state.lastLetter && w[0] !== state.lastLetter) {
      toast.error(`Must start with "${state.lastLetter.toUpperCase()}".`);
      return;
    }
    if (state.words.includes(w)) {
      toast.error("Already used.");
      return;
    }
    const words = [...state.words, w];
    const nextTurn: Turn = state.turn === "host" ? "opp" : "host";
    setGuess("");
    await update({
      state: { words, turn: nextTurn, lastLetter: w[w.length - 1], round: state.round } as unknown as Record<string, unknown>,
    });
  };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="flex items-center justify-between text-sm">
        {isMyMove ? (
          <span className="text-primary font-medium">Your turn</span>
        ) : (
          <span className="text-muted-foreground">Opponent's turn…</span>
        )}
        {isMyMove && (
          <span className={`tabular-nums font-medium ${secondsLeft <= 5 ? "text-red-400" : "text-muted-foreground"}`}>
            {secondsLeft}s
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-border/30 bg-card/60 p-4 min-h-[120px]">
        {state.words.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {isMyMove ? "Play any word to start the chain." : "Waiting for the first word…"}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {state.words.map((w, i) => (
              <span
                key={i}
                className={`rounded-lg px-2.5 py-1 text-sm ${
                  i === state.words.length - 1
                    ? "bg-primary/20 text-primary font-medium"
                    : "bg-card text-foreground"
                }`}
              >
                {w}
              </span>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <Input
          autoFocus
          disabled={!isMyMove}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder={state.lastLetter ? `Word starting with "${state.lastLetter.toUpperCase()}"` : "Any word"}
          className="bg-card/60 border-border/30"
        />
        <Button type="submit" disabled={!isMyMove}>Send</Button>
      </form>
    </div>
  );
}
