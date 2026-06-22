import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Board = number[]; // length 16, 0 = empty
type Dir = "left" | "right" | "up" | "down";

const emptyBoard = (): Board => Array(16).fill(0);

function addRandomTile(board: Board): Board {
  const empties = board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  if (empties.length === 0) return board;
  const idx = empties[Math.floor(Math.random() * empties.length)];
  const next = [...board];
  next[idx] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slide(line: number[]): { line: number[]; gained: number } {
  const nums = line.filter((n) => n !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
      const merged = nums[i] * 2;
      out.push(merged);
      gained += merged;
      i++;
    } else {
      out.push(nums[i]);
    }
  }
  while (out.length < 4) out.push(0);
  return { line: out, gained };
}

// Index helpers for the four directions.
const LINES: Record<Dir, number[][]> = {
  left: [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => r * 4 + c)),
  right: [0, 1, 2, 3].map((r) => [3, 2, 1, 0].map((c) => r * 4 + c)),
  up: [0, 1, 2, 3].map((c) => [0, 1, 2, 3].map((r) => r * 4 + c)),
  down: [0, 1, 2, 3].map((c) => [3, 2, 1, 0].map((r) => r * 4 + c)),
};

function move(board: Board, dir: Dir): { board: Board; gained: number; moved: boolean } {
  const next = [...board];
  let gained = 0;
  let moved = false;
  for (const idxs of LINES[dir]) {
    const line = idxs.map((i) => board[i]);
    const res = slide(line);
    gained += res.gained;
    idxs.forEach((boardIdx, k) => {
      if (next[boardIdx] !== res.line[k]) moved = true;
      next[boardIdx] = res.line[k];
    });
  }
  return { board: next, gained, moved };
}

function hasMoves(board: Board): boolean {
  if (board.some((v) => v === 0)) return true;
  return (["left", "up"] as Dir[]).some((d) => move(board, d).moved);
}

const TILE_STYLES: Record<number, string> = {
  2: "bg-amber-100/90 text-amber-900",
  4: "bg-amber-200/90 text-amber-900",
  8: "bg-orange-300 text-orange-950",
  16: "bg-orange-400 text-orange-950",
  32: "bg-orange-500 text-white",
  64: "bg-rose-500 text-white",
  128: "bg-amber-400 text-amber-950",
  256: "bg-amber-500 text-white",
  512: "bg-yellow-400 text-yellow-950",
  1024: "bg-yellow-500 text-white",
  2048: "bg-primary text-primary-foreground",
};

export default function Tile2048() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const submitted = useRef(false);
  const scoreRef = useRef(0);

  const newGame = useCallback(() => {
    setBoard(addRandomTile(addRandomTile(emptyBoard())));
    setScore(0);
    scoreRef.current = 0;
    setOver(false);
    setWon(false);
    submitted.current = false;
  }, []);

  useEffect(() => {
    newGame();
  }, [newGame]);

  const submitScore = useCallback(
    (finalScore: number, highTile: number) => {
      if (submitted.current || !user) return;
      submitted.current = true;
      void (async () => {
        const { error } = await supabase.from("game_scores").insert({
          game_key: "2048",
          user_id: user.id,
          score: finalScore,
          detail: { highTile },
        });
        if (error) toast.error("Couldn't save your score.");
        else {
          toast.success(`Score saved: ${finalScore.toLocaleString()} pts`);
          queryClient.invalidateQueries({ queryKey: ["leaderboard", "2048"] });
        }
      })();
    },
    [user, queryClient]
  );

  const doMove = useCallback(
    (dir: Dir) => {
      if (over) return;
      setBoard((prev) => {
        const res = move(prev, dir);
        if (!res.moved) return prev;
        const withTile = addRandomTile(res.board);
        const newScore = scoreRef.current + res.gained;
        scoreRef.current = newScore;
        setScore(newScore);
        if (!won && withTile.includes(2048)) {
          setWon(true);
          toast.success("You reached 2048!");
        }
        if (!hasMoves(withTile)) {
          setOver(true);
          submitScore(newScore, Math.max(...withTile));
        }
        return withTile;
      });
    },
    [over, won, submitScore]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        a: "left",
        d: "right",
        w: "up",
        s: "down",
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        doMove(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doMove]);

  return (
    <div className="space-y-4 max-w-sm mx-auto">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Score: <span className="text-foreground font-semibold tabular-nums">{score.toLocaleString()}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={newGame} title="New game">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {over && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-center animate-fade-in">
          <Trophy className="w-7 h-7 text-amber-400 mx-auto mb-2" />
          <p className="font-display font-semibold text-foreground">Game over</p>
          <p className="text-sm text-muted-foreground">Final score {score.toLocaleString()}</p>
          <Button className="mt-3" onClick={newGame}>Play again</Button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 rounded-2xl bg-card/80 border border-border/30 p-2">
        {board.map((v, i) => (
          <div
            key={i}
            className={`aspect-square rounded-xl flex items-center justify-center font-display font-bold tabular-nums transition-colors ${
              v === 0 ? "bg-muted/10" : TILE_STYLES[v] ?? "bg-primary text-primary-foreground"
            } ${v >= 1024 ? "text-lg" : "text-2xl"}`}
          >
            {v !== 0 ? v : ""}
          </div>
        ))}
      </div>

      {/* On-screen controls (touch / no keyboard) */}
      <div className="flex flex-col items-center gap-2 pt-1">
        <Button variant="secondary" size="icon" onClick={() => doMove("up")}><ArrowUp className="w-4 h-4" /></Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="icon" onClick={() => doMove("left")}><ArrowLeft className="w-4 h-4" /></Button>
          <Button variant="secondary" size="icon" onClick={() => doMove("down")}><ArrowDown className="w-4 h-4" /></Button>
          <Button variant="secondary" size="icon" onClick={() => doMove("right")}><ArrowRight className="w-4 h-4" /></Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Use arrow keys or WASD</p>
      </div>
    </div>
  );
}
