import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  RotateCcw, Trophy, ArrowRight,
  Heart, Star, Music, Rocket, Crown, Flame, Cloud, Sun, Moon, Zap, Anchor, Apple,
  Bell, Bird, Cake, Camera, Car, Cat, Cherry, Coffee, Compass, Cookie, Diamond, Dog,
  Droplet, Egg, Eye, Feather, Fish, Flower, Gem, Ghost, Gift, Guitar, Key, Leaf,
  Lightbulb, Map, Medal, Mountain, Palette, Pizza, Plane, Rabbit, Snowflake, Sparkles,
  Sprout, Sword, Tent, TreePine, Umbrella, Waves, Wind, Bug, Dumbbell, Flag,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { movesTimeScore } from "@/lib/games";
import { getUnlockedLevel, unlockNextLevel, lerpByLevel, TOTAL_LEVELS } from "@/lib/levels";
import { Button } from "@/components/ui/button";
import LevelBar from "./LevelBar";
import { toast } from "sonner";

const GAME_KEY = "memory-match";

// A large pool so every level can show a different set of icons.
const ICON_POOL: LucideIcon[] = [
  Heart, Star, Music, Rocket, Crown, Flame, Cloud, Sun, Moon, Zap, Anchor, Apple,
  Bell, Bird, Cake, Camera, Car, Cat, Cherry, Coffee, Compass, Cookie, Diamond, Dog,
  Droplet, Egg, Eye, Feather, Fish, Flower, Gem, Ghost, Gift, Guitar, Key, Leaf,
  Lightbulb, Map, Medal, Mountain, Palette, Pizza, Plane, Rabbit, Snowflake, Sparkles,
  Sprout, Sword, Tent, TreePine, Umbrella, Waves, Wind, Bug, Dumbbell, Flag,
];

const COLORS = [
  "text-rose-400", "text-amber-400", "text-teal-400", "text-sky-400", "text-yellow-400",
  "text-orange-400", "text-indigo-300", "text-fuchsia-400", "text-emerald-400", "text-violet-400",
  "text-cyan-400", "text-lime-400",
];

// ── Per-level difficulty ───────────────────────────────────────────────
const pairsForLevel = (level: number) => Math.min(12, 4 + Math.floor((level - 1) / 2));
const flipDelayForLevel = (level: number) => Math.round(lerpByLevel(level, 950, 500));
const colsForCards = (cards: number) => Math.max(4, Math.min(6, Math.ceil(Math.sqrt(cards))));

// Each level draws a distinct window from the pool (stride keeps sets varied).
function symbolsForLevel(level: number) {
  const pairs = pairsForLevel(level);
  const start = ((level - 1) * 7) % ICON_POOL.length;
  return Array.from({ length: pairs }, (_, i) => {
    const idx = (start + i) % ICON_POOL.length;
    return { key: `i${idx}`, Icon: ICON_POOL[idx], color: COLORS[i % COLORS.length] };
  });
}

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

  const [level, setLevel] = useState(() => getUnlockedLevel(GAME_KEY));
  const [unlocked, setUnlocked] = useState(() => getUnlockedLevel(GAME_KEY));

  const symbols = useMemo(() => symbolsForLevel(level), [level]);
  const symbolByKey = useMemo(() => Object.fromEntries(symbols.map((s) => [s.key, s])), [symbols]);
  const cols = colsForCards(symbols.length * 2);
  const flipDelay = flipDelayForLevel(level);

  const [cards, setCards] = useState<Tile[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const submitted = useRef(false);

  const initGame = useCallback(() => {
    const keys = symbols.map((s) => s.key);
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
  }, [symbols]);

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
        }, flipDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [flipped, cards, flipDelay]);

  useEffect(() => {
    if (matches === symbols.length && matches > 0) setGameWon(true);
  }, [matches, symbols.length]);

  // Submit score once on win and unlock the next level.
  useEffect(() => {
    if (!gameWon || submitted.current) return;
    submitted.current = true;
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    const base = movesTimeScore(moves, seconds);
    const score = Math.round(base * (1 + level * 0.15)); // reward harder levels
    setUnlocked(unlockNextLevel(GAME_KEY, level));
    if (!user) return;
    void (async () => {
      const { error } = await supabase.from("game_scores").insert({
        game_key: GAME_KEY,
        user_id: user.id,
        score,
        detail: { moves, seconds, level },
      });
      if (error) {
        toast.error("Couldn't save your score.");
      } else {
        toast.success(`Level ${level} cleared · ${score.toLocaleString()} pts`);
        queryClient.invalidateQueries({ queryKey: ["leaderboard", GAME_KEY] });
      }
    })();
  }, [gameWon, moves, startTime, user, queryClient, level]);

  const handleCardClick = (index: number) => {
    if (flipped.length === 2 || cards[index].flipped || cards[index].matched) return;
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, flipped: true } : c)));
    setFlipped((prev) => [...prev, index]);
    if (flipped.length === 0) setMoves((m) => m + 1);
  };

  const hasNext = level < TOTAL_LEVELS;

  return (
    <div className="space-y-4">
      <LevelBar
        level={level}
        unlocked={unlocked}
        hint={`${symbols.length} pairs`}
        onSelect={setLevel}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div>Moves: <span className="text-foreground font-medium">{moves}</span></div>
          <div>Time: <span className="text-foreground font-medium">{formatTime(elapsed)}</span></div>
          <div>Matches: <span className="text-foreground font-medium">{matches}/{symbols.length}</span></div>
        </div>
        <Button variant="ghost" size="icon" onClick={initGame} title="Restart level">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {gameWon && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center animate-fade-in">
          <Trophy className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-lg font-display font-semibold text-foreground">Level {level} cleared!</p>
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
        className="grid gap-3 max-w-md mx-auto"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cards.map((card, i) => {
          const sym = symbolByKey[card.key];
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
