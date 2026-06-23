import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { getUnlockedLevel, unlockNextLevel, TOTAL_LEVELS } from "@/lib/levels";
import { Button } from "@/components/ui/button";
import LevelBar from "./LevelBar";
import { toast } from "sonner";

const GAME_KEY = "2048";

type Board = number[]; // length size*size, 0 = empty
type Dir = "left" | "right" | "up" | "down";

// Smaller boards + higher targets = harder.
const sizeForLevel = (level: number) => (level <= 10 ? 5 : 4);
const TARGETS = [256, 512, 1024, 2048, 4096];
const targetForLevel = (level: number) => TARGETS[Math.min(TARGETS.length - 1, Math.floor((level - 1) / 4))];

const emptyBoard = (size: number): Board => Array(size * size).fill(0);

function addRandomTile(board: Board): Board {
  const empties = board.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  if (empties.length === 0) return board;
  const idx = empties[Math.floor(Math.random() * empties.length)];
  const next = [...board];
  next[idx] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slide(line: number[], size: number): { line: number[]; gained: number } {
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
  while (out.length < size) out.push(0);
  return { line: out, gained };
}

function buildLines(size: number, dir: Dir): number[][] {
  const at = (r: number, c: number) => r * size + c;
  const lines: number[][] = [];
  if (dir === "left" || dir === "right") {
    for (let r = 0; r < size; r++) {
      const line: number[] = [];
      for (let c = 0; c < size; c++) line.push(at(r, dir === "left" ? c : size - 1 - c));
      lines.push(line);
    }
  } else {
    for (let c = 0; c < size; c++) {
      const line: number[] = [];
      for (let r = 0; r < size; r++) line.push(at(dir === "up" ? r : size - 1 - r, c));
      lines.push(line);
    }
  }
  return lines;
}

function move(board: Board, dir: Dir, size: number): { board: Board; gained: number; moved: boolean } {
  const next = [...board];
  let gained = 0;
  let moved = false;
  for (const idxs of buildLines(size, dir)) {
    const line = idxs.map((i) => board[i]);
    const res = slide(line, size);
    gained += res.gained;
    idxs.forEach((boardIdx, k) => {
      if (next[boardIdx] !== res.line[k]) moved = true;
      next[boardIdx] = res.line[k];
    });
  }
  return { board: next, gained, moved };
}

function hasMoves(board: Board, size: number): boolean {
  if (board.some((v) => v === 0)) return true;
  return (["left", "up"] as Dir[]).some((d) => move(board, d, size).moved);
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
  4096: "bg-fuchsia-500 text-white",
};

export default function Tile2048() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [level, setLevel] = useState(() => getUnlockedLevel(GAME_KEY));
  const [unlocked, setUnlocked] = useState(() => getUnlockedLevel(GAME_KEY));
  const size = useMemo(() => sizeForLevel(level), [level]);
  const target = useMemo(() => targetForLevel(level), [level]);

  const [board, setBoard] = useState<Board>(() => emptyBoard(size));
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const submitted = useRef(false);
  const scoreRef = useRef(0);

  const newGame = useCallback(() => {
    setBoard(addRandomTile(addRandomTile(emptyBoard(size))));
    setScore(0);
    scoreRef.current = 0;
    setOver(false);
    setWon(false);
    submitted.current = false;
  }, [size]);

  useEffect(() => {
    newGame();
  }, [newGame]);

  const submitScore = useCallback(
    (finalScore: number, highTile: number) => {
      if (submitted.current || !user) return;
      submitted.current = true;
      void (async () => {
        const { error } = await supabase.from("game_scores").insert({
          game_key: GAME_KEY,
          user_id: user.id,
          score: finalScore,
          detail: { highTile, level, size, target },
        });
        if (error) toast.error("Couldn't save your score.");
        else {
          toast.success(`Score saved: ${finalScore.toLocaleString()} pts`);
          queryClient.invalidateQueries({ queryKey: ["leaderboard", GAME_KEY] });
        }
      })();
    },
    [user, queryClient, level, size, target]
  );

  const doMove = useCallback(
    (dir: Dir) => {
      if (over) return;
      setBoard((prev) => {
        const res = move(prev, dir, size);
        if (!res.moved) return prev;
        const withTile = addRandomTile(res.board);
        const newScore = scoreRef.current + res.gained;
        scoreRef.current = newScore;
        setScore(newScore);
        if (!won && withTile.includes(target)) {
          setWon(true);
          setUnlocked(unlockNextLevel(GAME_KEY, level));
          toast.success(`Level ${level} cleared — you reached ${target}!`);
        }
        if (!hasMoves(withTile, size)) {
          setOver(true);
          submitScore(newScore, Math.max(...withTile));
        }
        return withTile;
      });
    },
    [over, won, submitScore, size, target, level]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
        a: "left", d: "right", w: "up", s: "down",
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

  const hasNext = level < TOTAL_LEVELS;

  return (
    <div className="space-y-4 max-w-sm mx-auto">
      <LevelBar level={level} unlocked={unlocked} hint={`${size}×${size} · reach ${target}`} onSelect={setLevel} />

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Score: <span className="text-foreground font-semibold tabular-nums">{score.toLocaleString()}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={newGame} title="New game">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {won && !over && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center animate-fade-in">
          <p className="text-sm font-medium text-emerald-300">
            Level {level} cleared! Keep going for points, or jump to the next level.
          </p>
          {hasNext && (
            <Button size="sm" className="mt-2" onClick={() => setLevel((l) => l + 1)}>
              Level {level + 1} <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {over && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-center animate-fade-in">
          <Trophy className="w-7 h-7 text-amber-400 mx-auto mb-2" />
          <p className="font-display font-semibold text-foreground">Game over</p>
          <p className="text-sm text-muted-foreground">Final score {score.toLocaleString()}</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <Button variant="outline" onClick={newGame}>Play again</Button>
            {won && hasNext && (
              <Button onClick={() => setLevel((l) => l + 1)}>
                Level {level + 1} <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      <div
        className="grid gap-2 rounded-2xl bg-card/80 border border-border/30 p-2"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {board.map((v, i) => (
          <div
            key={i}
            className={`aspect-square rounded-xl flex items-center justify-center font-display font-bold tabular-nums transition-colors ${
              v === 0 ? "bg-muted/10" : TILE_STYLES[v] ?? "bg-primary text-primary-foreground"
            } ${v >= 1024 || size >= 5 ? "text-base" : "text-2xl"}`}
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
