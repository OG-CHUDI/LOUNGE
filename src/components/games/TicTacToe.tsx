import { useState } from "react";
import { useAuth } from "@/lib/auth";
import MatchLobby from "./MatchLobby";
import MatchShell from "./MatchShell";
import { useMatchChannel, type MatchRow, type Turn } from "./useMatch";

type Cell = null | "X" | "O";
interface TTTState {
  board: Cell[];
  turn: Turn;
  round: number;
}

const emptyBoard = (): Cell[] => Array(9).fill(null);
const EMPTY: TTTState = { board: emptyBoard(), turn: "host", round: 0 };

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winnerOf(board: Cell[]): Cell {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

// Rematch: reset the board and alternate who starts.
const makeRematch = (prev: Record<string, unknown>): Record<string, unknown> => {
  const round = Number((prev as { round?: number }).round ?? 0) + 1;
  return { board: emptyBoard(), turn: round % 2 === 0 ? "host" : "opp", round } as unknown as Record<string, unknown>;
};

export default function TicTacToe({ gameId }: { gameId: string }) {
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
  return <TTTGame matchId={matchId} userId={user?.id ?? ""} onLeave={() => setMatchId(null)} />;
}

function TTTGame({ matchId, userId, onLeave }: { matchId: string; userId: string; onLeave: () => void }) {
  const { match, update, opponentPresent, opponentId } = useMatchChannel(matchId, userId);

  return (
    <MatchShell
      match={match}
      update={update}
      userId={userId}
      opponentId={opponentId}
      opponentPresent={opponentPresent}
      gameKey="tic-tac-toe"
      makeRematch={makeRematch}
      onLeave={onLeave}
    >
      {() => <TTTActive match={match!} update={update} userId={userId} />}
    </MatchShell>
  );
}

function TTTActive({
  match,
  update,
  userId,
}: {
  match: MatchRow;
  update: (p: Partial<Pick<MatchRow, "state" | "status" | "score">>) => Promise<void>;
  userId: string;
}) {
  const state = (match.state as unknown as TTTState) ?? EMPTY;
  const isHost = match.host_id === userId;
  const myTurn: Turn = isHost ? "host" : "opp";
  const mySymbol: Cell = isHost ? "X" : "O";
  const isMyMove = state.turn === myTurn;

  const place = async (idx: number) => {
    if (!isMyMove || state.board[idx]) return;
    const board = [...state.board];
    board[idx] = mySymbol;
    const w = winnerOf(board);
    const full = board.every((c) => c !== null);
    const nextTurn: Turn = state.turn === "host" ? "opp" : "host";
    const nextState = { board, turn: nextTurn, round: state.round } as unknown as Record<string, unknown>;

    if (w) {
      await update({ state: nextState, status: "done", score: { winner: userId } as Record<string, unknown> });
    } else if (full) {
      await update({ state: nextState, status: "done", score: {} });
    } else {
      await update({ state: nextState });
    }
  };

  return (
    <div className="space-y-4 max-w-xs mx-auto">
      <div className="text-center text-sm">
        {isMyMove ? (
          <span className="text-primary font-medium">Your move ({mySymbol})</span>
        ) : (
          <span className="text-muted-foreground">Opponent's move…</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {state.board.map((cell, i) => (
          <button
            key={i}
            onClick={() => place(i)}
            disabled={!isMyMove || !!cell}
            className={`aspect-square rounded-2xl border border-border/30 bg-card/60 flex items-center justify-center font-display text-4xl font-bold transition-colors ${
              isMyMove && !cell ? "hover:bg-card cursor-pointer" : ""
            } ${cell === "X" ? "text-sky-400" : cell === "O" ? "text-rose-400" : "text-foreground"}`}
          >
            {cell}
          </button>
        ))}
      </div>
    </div>
  );
}
