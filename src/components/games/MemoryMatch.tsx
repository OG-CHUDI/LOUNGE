import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  RotateCcw,
  Trophy,
  Heart,
  Star,
  Music,
  Rocket,
  Crown,
  Flame,
  Cloud,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { movesTimeScore } from "@/lib/games";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SYMBOLS: { key: string; Icon: LucideIcon; color: string }[] = [
  { key: "heart", Icon: Heart, color: "text-rose-400" },
  { key: "star", Icon: Star, color: "text-amber-400" },
  { key: "music", Icon: Music, color: "text-teal-400" },
  { key: "rocket", Icon: Rocket, color: "text-sky-400" },
  { key: "crown", Icon: Crown, color: "text-yellow-400" },
  { key: "flame", Icon: Flame, color: "text-orange-400" },
  { key: "cloud", Icon: Cloud, color: "text-indigo-300" },
  { key: "sun", Icon: Sun, color: "text-fuchsia-400" },
];
const SYMBOL_BY_KEY = Object.fromEntries(SYMBOLS.map((s) => [s.key, s]));

interface Tile {
  id: number;
  key: string;
  flipped: boolean;
  matched: boolean;
}

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

export default function MemoryMatch() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [cards, setCards] = useState<Tile[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const submitted = useRef(false);

  const initGame = useCallback(() => {
    const keys = SYMBOLS.map((s) => s.key);
    const shuffled = [...keys, ...keys]
      .sort(() => Math.random() - 0.5)
      .map((key, i) => ({ id: i, key, flipped: false, matched: false }));
    setCards(shuffled);
    setFlipped([]);
    setMoves(0);
    setMatches(0);
    setGameWon(false);
    setStartTime(Date.now());
    setElapsed(0);
    submitted.current = false;
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  useEffect(() => {
    if (gameWon) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, gameWon]);

  useEffect(() => {
    if (flipped.length === 2) {
      const [a, b] = flipped;
      if (cards[a].key === cards[b].key) {
        setCards((prev) => prev.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)));
        setMatches((m) => m + 1);
        setFlipped([]);
      } else {
        const timer = setTimeout(() => {
          setCards((prev) => prev.map((c, i) => (i === a || i === b ? { ...c, flipped: false } : c)));
          setFlipped([]);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [flipped, cards]);

  useEffect(() => {
    if (matches === SYMBOLS.length && matches > 0) setGameWon(true);
  }, [matches]);

  // Submit score once on win.
  useEffect(() => {
    if (!gameWon || submitted.current) return;
    submitted.current = true;
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    const score = movesTimeScore(moves, seconds);
    if (!user) return;
    void (async () => {
      const { error } = await supabase.from("game_scores").insert({
        game_key: "memory-match",
        user_id: user.id,
        score,
        detail: { moves, seconds },
      });
      if (error) {
        toast.error("Couldn't save your score.");
      } else {
        toast.success(`Score saved: ${score.toLocaleString()} pts`);
        queryClient.invalidateQueries({ queryKey: ["leaderboard", "memory-match"] });
      }
    })();
  }, [gameWon, moves, startTime, user, queryClient]);

  const handleCardClick = (index: number) => {
    if (flipped.length === 2 || cards[index].flipped || cards[index].matched) return;
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, flipped: true } : c)));
    setFlipped((prev) => [...prev, index]);
    if (flipped.length === 0) setMoves((m) => m + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div>Moves: <span className="text-foreground font-medium">{moves}</span></div>
          <div>Time: <span className="text-foreground font-medium">{formatTime(elapsed)}</span></div>
          <div>Matches: <span className="text-foreground font-medium">{matches}/{SYMBOLS.length}</span></div>
        </div>
        <Button variant="ghost" size="icon" onClick={initGame} title="New game">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {gameWon && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center animate-fade-in">
          <Trophy className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-lg font-display font-semibold text-foreground">You won!</p>
          <p className="text-sm text-muted-foreground">{moves} moves in {formatTime(elapsed)}</p>
          <Button className="mt-3" onClick={initGame}>Play again</Button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
        {cards.map((card, i) => {
          const sym = SYMBOL_BY_KEY[card.key];
          const revealed = card.flipped || card.matched;
          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(i)}
              disabled={revealed}
              className={`aspect-square rounded-2xl flex items-center justify-center transition-all duration-300 ${
                revealed
                  ? "bg-primary/15 border border-primary/30"
                  : "bg-card/80 border border-border/30 hover:bg-card"
              } ${card.matched ? "ring-2 ring-emerald-400/50" : ""}`}
            >
              {revealed && sym && <sym.Icon className={`w-7 h-7 ${sym.color}`} strokeWidth={1.5} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
