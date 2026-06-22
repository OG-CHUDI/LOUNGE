import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, LogOut, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSuppressBackground } from "@/lib/background";
import { submitWin, type MatchRow } from "./useMatch";

type Patch = Partial<Pick<MatchRow, "state" | "status" | "score">>;

interface Props {
  match: MatchRow | null;
  update: (patch: Patch) => Promise<void>;
  userId: string;
  opponentId: string | null;
  opponentPresent: boolean;
  gameKey: string;
  /** Fresh state for a rematch, given the previous round's state. */
  makeRematch: (prev: Record<string, unknown>) => Record<string, unknown>;
  /** Back to the lobby. */
  onLeave: () => void;
  /** Optional extra line shown on the result screen (e.g. "The word was X"). */
  resultDetail?: ReactNode;
  /** The active-match play surface. Only rendered while status === "active". */
  children: () => ReactNode;
}

// How long to wait for a vanished opponent to reconnect before claiming the win.
const FORFEIT_GRACE_MS = 8000;

/**
 * Owns every non-gameplay state of a head-to-head match: loading, waiting for
 * accept, declined/cancelled, opponent-disconnected (with grace + auto-claim),
 * forfeit, the result screen, rematch, and the single authoritative win-row
 * submission. Individual games only render the active board via `children`.
 */
export default function MatchShell({
  match,
  update,
  userId,
  opponentId,
  opponentPresent,
  gameKey,
  makeRematch,
  onLeave,
  resultDetail,
  children,
}: Props) {
  const queryClient = useQueryClient();
  const submittedRound = useRef<string | null>(null);
  const [graceLeft, setGraceLeft] = useState<number | null>(null);

  const status = match?.status;

  // Switch the global animated background off during a live round.
  useSuppressBackground(status === "active");

  const round = Number((match?.state as { round?: number } | undefined)?.round ?? 0);
  const roundKey = match ? `${match.id}-${round}` : "";
  const winnerId = (match?.score as { winner?: string } | undefined)?.winner;

  // Resolve → refresh the board for both players; the winner writes one win row.
  useEffect(() => {
    if (status !== "done" || !match) return;
    queryClient.invalidateQueries({ queryKey: ["leaderboard", gameKey] });
    if (winnerId && winnerId === userId && submittedRound.current !== roundKey) {
      submittedRound.current = roundKey;
      submitWin(gameKey, winnerId).then(() =>
        queryClient.invalidateQueries({ queryKey: ["leaderboard", gameKey] }),
      );
    }
  }, [status, winnerId, roundKey, userId, gameKey, queryClient, match]);

  // Opponent disconnected mid-match → grace countdown, then claim the win.
  useEffect(() => {
    if (status !== "active" || !opponentId || opponentPresent) {
      setGraceLeft(null);
      return;
    }
    const startedAt = Date.now();
    setGraceLeft(Math.ceil(FORFEIT_GRACE_MS / 1000));
    const iv = setInterval(() => {
      const left = Math.ceil((FORFEIT_GRACE_MS - (Date.now() - startedAt)) / 1000);
      if (left <= 0) {
        clearInterval(iv);
        setGraceLeft(null);
        void update({ status: "done", score: { winner: userId } as Record<string, unknown> });
      } else {
        setGraceLeft(left);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [status, opponentPresent, opponentId, userId, update]);

  if (!match) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading match…
      </div>
    );
  }

  if (status === "waiting") {
    return (
      <div className="text-center py-16 space-y-3">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">Waiting for your opponent to accept…</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await update({ status: "declined" });
            onLeave();
          }}
        >
          Cancel challenge
        </Button>
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-sm text-muted-foreground">Challenge declined or cancelled.</p>
        <Button size="sm" onClick={onLeave}>Back to lobby</Button>
      </div>
    );
  }

  if (status === "done") {
    const iWon = winnerId === userId;
    const isDraw = !winnerId;
    return (
      <div className="space-y-5 max-w-md mx-auto text-center">
        <div className="py-6">
          <p className="font-display text-2xl font-bold text-foreground">
            {isDraw ? "It's a draw" : iWon ? "You win!" : "You lost"}
          </p>
          {resultDetail && <div className="mt-2 text-sm text-muted-foreground">{resultDetail}</div>}
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button
            onClick={() =>
              update({
                status: "active",
                score: {},
                state: makeRematch((match.state ?? {}) as Record<string, unknown>),
              })
            }
          >
            <RotateCcw className="w-4 h-4 mr-1.5" /> Rematch
          </Button>
          <Button variant="ghost" onClick={onLeave}>Back to lobby</Button>
        </div>
      </div>
    );
  }

  // status === "active"
  return (
    <div className="space-y-4">
      {!opponentPresent && graceLeft !== null && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          <WifiOff className="w-3.5 h-3.5" />
          Opponent disconnected — claiming the win in {graceLeft}s…
        </div>
      )}

      <div key={roundKey}>{children()}</div>

      <div className="text-center pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() =>
            update({
              status: "done",
              score: { winner: opponentId ?? undefined } as Record<string, unknown>,
            })
          }
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5" /> Forfeit & leave
        </Button>
      </div>
    </div>
  );
}
