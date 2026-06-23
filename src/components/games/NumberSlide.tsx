import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shuffle, Trophy, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { movesTimeScore } from "@/lib/games";
import { getUnlockedLevel, unlockNextLevel, TOTAL_LEVELS } from "@/lib/levels";
import { Button } from "@/components/ui/button";
import LevelBar from "./LevelBar";
import { toast } from "sonner";

const GAME_KEY = "number-slide";

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

// Grid grows every five levels: 3×3 → 4×4 → 5×5 → 6×6.
const sizeForLevel = (level: number) => (level <= 5 ? 3 : level <= 10 ? 4 : level <= 15 ? 5 : 6);
const scrambleSteps = (level: number, size: number) => size * size * 8 + level * 15;

// A solved board is [1, 2, …, n-1, 0]; 0 is the blank.
const solvedBoard = (size: number) => {
  const arr = Array.from({ length: size * size }, (_, i) => i + 1);
  arr[arr.length - 1] = 0;
  return arr;
};

function scramble(size: number, steps: number): number[] {
  const board = solvedBoard(size);
  let empty = board.length - 1;
  for (let i = 0; i < steps; i++) {
    const row = Math.floor(empty / size);
    const col = empty % size;
    const neighbors: number[] = [];
    if (row > 0) neighbors.push(empty - size);
    if (row < size - 1) neighbors.push(empty + size);
    if (col > 0) neighbors.push(empty - 1);
    if (col < size - 1) neighbors.push(empty + 1);
    const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
    [board[empty], board[pick]] = [board[pick], board[empty]];
    empty = pick;
  }
  return board;
}

export default function NumberSlide() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [level, setLevel] = useState(() => getUnlockedLevel(GAME_KEY));
  const [unlocked, setUnlocked] = useState(() => getUnlockedLevel(GAME_KEY));
  const size = useMemo(() => sizeForLevel(level), [level]);

  const [tiles, setTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [solved, setSolved] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const submitted = useRef(false);

  const initGame = useCallback(() => {
    setTiles(scramble(size, scrambleSteps(level, size)));
    setMoves(0);
    setSolved(false);
    setStartTime(Date.now());
    setElapsed(0);
    submitted.current = false;
  }, [size, level]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  useEffect(() => {
    if (solved) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, solved]);

  useEffect(() => {
    if (!solved || submitted.current) return;
    submitted.current = true;
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    const base = movesTimeScore(moves, seconds, 4000 + size * size * 1500, 15, 4);
    const score = Math.round(base * (1 + level * 0.1));
    setUnlocked(unlockNextLevel(GAME_KEY, level));
    if (!user) return;
    void (async () => {
      const { error } = await supabase.from("game_scores").insert({
        game_key: GAME_KEY,
        user_id: user.id,
        score,
        detail: { moves, seconds, level, size },
      });
      if (error) {
        toast.error("Couldn't save your score.");
      } else {
        toast.success(`Level ${level} cleared · ${score.toLocaleString()} pts`);
        queryClient.invalidateQueries({ queryKey: ["leaderboard", GAME_KEY] });
      }
    })();
  }, [solved, moves, startTime, user, queryClient, level, size]);

  const handleTileClick = (index: number) => {
    if (solved) return;
    const emptyIdx = tiles.indexOf(0);
    const row = Math.floor(index / size);
    const col = index % size;
    const emptyRow = Math.floor(emptyIdx / size);
    const emptyCol = emptyIdx % size;
    const isAdjacent =
      (Math.abs(row - emptyRow) === 1 && col === emptyCol) ||
      (Math.abs(col - emptyCol) === 1 && row === emptyRow);
    if (!isAdjacent) return;
    const next = [...tiles];
    [next[index], next[emptyIdx]] = [next[emptyIdx], next[index]];
    setTiles(next);
    setMoves((m) => m + 1);
    if (next.every((t, i) => t === (i === size * size - 1 ? 0 : i + 1))) setSolved(true);
  };

  const hasNext = level < TOTAL_LEVELS;

  return (
    <div className="space-y-4">
      <LevelBar level={level} unlocked={unlocked} hint={`${size}×${size} grid`} onSelect={setLevel} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div>Moves: <span className="text-foreground font-medium">{moves}</span></div>
          <div>Time: <span className="text-foreground font-medium">{formatTime(elapsed)}</span></div>
        </div>
        <Button variant="ghost" size="icon" onClick={initGame} title="Re-scramble">
          <Shuffle className="w-4 h-4" />
        </Button>
      </div>

      {solved && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center animate-fade-in">
          <Trophy className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-lg font-display font-semibold text-foreground">Level {level} solved!</p>
          <p className="text-sm text-muted-foreground">{moves} moves in {formatTime(elapsed)}</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <Button variant="outline" onClick={initGame}>Replay</Button>
            {hasNext && (
              <Button onClick={() => setLevel((l) => l + 1)}>
                Level {level + 1} <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      <div
        className="grid gap-2 max-w-xs mx-auto rounded-2xl border border-border/30 bg-card/40 p-3"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {tiles.map((num, i) => (
          <button
            key={i}
            onClick={() => handleTileClick(i)}
            className={`aspect-square rounded-xl font-display font-bold flex items-center justify-center transition-all ${
              size >= 6 ? "text-xs" : size === 5 ? "text-sm" : "text-lg"
            } ${
              num === 0
                ? "bg-transparent"
                : "bg-primary/15 border border-primary/30 text-foreground hover:bg-primary/25"
            }`}
          >
            {num !== 0 && num}
          </button>
        ))}
      </div>
    </div>
  );
}
