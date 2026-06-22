import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shuffle, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { movesTimeScore } from "@/lib/games";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

export default function NumberSlide() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [tiles, setTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [solved, setSolved] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const submitted = useRef(false);

  const initGame = useCallback(() => {
    const goal = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
    const current = [...goal];
    let emptyIdx = 15;
    for (let i = 0; i < 200; i++) {
      const neighbors: number[] = [];
      const row = Math.floor(emptyIdx / 4);
      const col = emptyIdx % 4;
      if (row > 0) neighbors.push(emptyIdx - 4);
      if (row < 3) neighbors.push(emptyIdx + 4);
      if (col > 0) neighbors.push(emptyIdx - 1);
      if (col < 3) neighbors.push(emptyIdx + 1);
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      [current[emptyIdx], current[pick]] = [current[pick], current[emptyIdx]];
      emptyIdx = pick;
    }
    setTiles(current);
    setMoves(0);
    setSolved(false);
    setStartTime(Date.now());
    setElapsed(0);
    submitted.current = false;
  }, []);

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
    const score = movesTimeScore(moves, seconds, 12000, 20, 5);
    if (!user) return;
    void (async () => {
      const { error } = await supabase.from("game_scores").insert({
        game_key: "number-slide",
        user_id: user.id,
        score,
        detail: { moves, seconds },
      });
      if (error) {
        toast.error("Couldn't save your score.");
      } else {
        toast.success(`Score saved: ${score.toLocaleString()} pts`);
        queryClient.invalidateQueries({ queryKey: ["leaderboard", "number-slide"] });
      }
    })();
  }, [solved, moves, startTime, user, queryClient]);

  const handleTileClick = (index: number) => {
    if (solved) return;
    const emptyIdx = tiles.indexOf(0);
    const row = Math.floor(index / 4);
    const col = index % 4;
    const emptyRow = Math.floor(emptyIdx / 4);
    const emptyCol = emptyIdx % 4;
    const isAdjacent =
      (Math.abs(row - emptyRow) === 1 && col === emptyCol) ||
      (Math.abs(col - emptyCol) === 1 && row === emptyRow);
    if (!isAdjacent) return;
    const next = [...tiles];
    [next[index], next[emptyIdx]] = [next[emptyIdx], next[index]];
    setTiles(next);
    setMoves((m) => m + 1);
    if (next.every((t, i) => t === (i === 15 ? 0 : i + 1))) setSolved(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div>Moves: <span className="text-foreground font-medium">{moves}</span></div>
          <div>Time: <span className="text-foreground font-medium">{formatTime(elapsed)}</span></div>
        </div>
        <Button variant="ghost" size="icon" onClick={initGame} title="Scramble">
          <Shuffle className="w-4 h-4" />
        </Button>
      </div>

      {solved && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center animate-fade-in">
          <Trophy className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-lg font-display font-semibold text-foreground">Puzzle solved!</p>
          <p className="text-sm text-muted-foreground">{moves} moves in {formatTime(elapsed)}</p>
          <Button className="mt-3" onClick={initGame}>Play again</Button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto rounded-2xl border border-border/30 bg-card/40 p-3">
        {tiles.map((num, i) => (
          <button
            key={i}
            onClick={() => handleTileClick(i)}
            className={`aspect-square rounded-xl font-display font-bold text-lg flex items-center justify-center transition-all ${
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
