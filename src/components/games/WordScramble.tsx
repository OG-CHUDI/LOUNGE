import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Trophy, SkipForward, Type, ArrowRight, Target } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { getUnlockedLevel, unlockNextLevel, TOTAL_LEVELS } from "@/lib/levels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LevelBar from "./LevelBar";
import { toast } from "sonner";

const GAME_KEY = "word-scramble";

// Words bucketed by length. Higher levels use longer words.
const WORD_BANK: Record<number, string[]> = {
  4: ["calm", "dawn", "echo", "glow", "herb", "iris", "jade", "kite", "lime", "mint", "nest", "opal", "peak", "reef", "sage", "tide", "vibe", "wave", "yarn", "zest"],
  5: ["amber", "bloom", "cedar", "delta", "ember", "glint", "haven", "ivory", "lemon", "maple", "noble", "olive", "prism", "quilt", "raven", "slate", "topaz", "vivid", "whale", "zebra"],
  6: ["anchor", "breeze", "candle", "dragon", "forest", "garden", "harbor", "island", "jungle", "lagoon", "meadow", "orchid", "pebble", "ribbon", "summit", "temple", "velvet", "willow", "bridge", "castle"],
  7: ["caramel", "dolphin", "emerald", "gateway", "harvest", "journey", "lantern", "mariner", "quarter", "rainbow", "saffron", "thunder", "unicorn", "vibrant", "whisker", "blossom", "crimson", "diamond", "freedom", "glacier"],
  8: ["airplane", "bookcase", "campfire", "daylight", "elephant", "flamingo", "keyboard", "lavender", "mountain", "notebook", "obsidian", "panorama", "raincoat", "seashell", "sunshine", "treasure", "umbrella", "vineyard", "woodland", "mushroom"],
  9: ["adventure", "butterfly", "chocolate", "crocodile", "education", "fireworks", "gathering", "hurricane", "invention", "jellyfish", "landscape", "moonlight", "orchestra", "raspberry", "satellite", "telescope", "waterfall", "wonderful", "xylophone", "dangerous"],
  10: ["aspiration", "basketball", "brainstorm", "cappuccino", "dictionary", "friendship", "generosity", "helicopter", "kingfisher", "lighthouse", "motivation", "navigation", "peppermint", "playground", "revolution", "strawberry", "toothbrush", "watermelon", "wilderness", "journalism"],
};

const lengthForLevel = (level: number) => Math.min(10, 4 + Math.floor((level - 1) / 3));
const timeForLevel = (level: number) => Math.max(35, 75 - level * 2);
const goalForLevel = (level: number) => 3 + Math.floor(level / 4);

function scramble(word: string): string {
  const letters = word.split("");
  let out = word;
  let guard = 0;
  while (out === word && guard < 20) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    out = letters.join("");
    guard++;
  }
  return out;
}

export default function WordScramble() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [level, setLevel] = useState(() => getUnlockedLevel(GAME_KEY));
  const [unlocked, setUnlocked] = useState(() => getUnlockedLevel(GAME_KEY));

  const wordLength = useMemo(() => lengthForLevel(level), [level]);
  const roundSeconds = useMemo(() => timeForLevel(level), [level]);
  const goal = useMemo(() => goalForLevel(level), [level]);
  const bank = WORD_BANK[wordLength];

  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [seconds, setSeconds] = useState(roundSeconds);
  const [solved, setSolved] = useState(0);
  const [cleared, setCleared] = useState(false);
  const [word, setWord] = useState("");
  const [scrambled, setScrambled] = useState("");
  const [guess, setGuess] = useState("");
  const submitted = useRef(false);

  const pickWord = useCallback(
    (exclude?: string) => {
      let w = bank[Math.floor(Math.random() * bank.length)];
      let guard = 0;
      while (w === exclude && guard < 10) {
        w = bank[Math.floor(Math.random() * bank.length)];
        guard++;
      }
      return w;
    },
    [bank]
  );

  const nextWord = useCallback(
    (prev?: string) => {
      const w = pickWord(prev);
      setWord(w);
      setScrambled(scramble(w));
      setGuess("");
    },
    [pickWord]
  );

  const start = () => {
    setSolved(0);
    setCleared(false);
    setSeconds(roundSeconds);
    setFinished(false);
    setPlaying(true);
    submitted.current = false;
    nextWord();
  };

  useEffect(() => {
    if (!playing) return;
    if (seconds <= 0) {
      setPlaying(false);
      setFinished(true);
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [playing, seconds]);

  useEffect(() => {
    if (!finished || submitted.current) return;
    submitted.current = true;
    const score = solved * wordLength * 10; // longer words = more points
    if (!user) return;
    void (async () => {
      const { error } = await supabase.from("game_scores").insert({
        game_key: GAME_KEY,
        user_id: user.id,
        score,
        detail: { words: solved, level, wordLength, cleared },
      });
      if (error) {
        toast.error("Couldn't save your score.");
      } else {
        toast.success(`${solved} ${solved === 1 ? "word" : "words"} · ${score.toLocaleString()} pts`);
        queryClient.invalidateQueries({ queryKey: ["leaderboard", GAME_KEY] });
      }
    })();
  }, [finished, solved, user, queryClient, level, wordLength, cleared]);

  const submitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playing) return;
    if (guess.trim().toLowerCase() === word.toLowerCase()) {
      const nextSolved = solved + 1;
      setSolved(nextSolved);
      if (!cleared && nextSolved >= goal) {
        setCleared(true);
        setUnlocked(unlockNextLevel(GAME_KEY, level));
        toast.success(`Level ${level} cleared! Keep solving for points.`);
      }
      nextWord(word);
    } else {
      setGuess("");
    }
  };

  const skip = () => {
    if (!playing) return;
    nextWord(word);
  };

  const hasNext = level < TOTAL_LEVELS;

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <LevelBar
        level={level}
        unlocked={unlocked}
        hint={`${wordLength} letters · ${roundSeconds}s · goal ${goal}`}
        onSelect={(l) => {
          setLevel(l);
          setPlaying(false);
          setFinished(false);
        }}
      />

      {!playing && !finished && (
        <div className="rounded-2xl border border-border/30 bg-card/60 p-8 text-center">
          <Type className="w-8 h-8 text-fuchsia-300 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-lg font-display font-semibold text-foreground">Word Scramble · Level {level}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Unscramble {wordLength}-letter words. Solve {goal} in {roundSeconds}s to clear the level.
          </p>
          <Button className="mt-4" onClick={start}>Start</Button>
        </div>
      )}

      {playing && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-4 h-4" /> <span className={`tabular-nums font-medium ${seconds <= 10 ? "text-red-400" : "text-foreground"}`}>{seconds}s</span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Target className="w-4 h-4" /> <span className="text-foreground font-medium">{Math.min(solved, goal)}/{goal}</span>
              {cleared && <span className="text-emerald-400 text-xs">cleared</span>}
            </span>
            <span className="text-muted-foreground">Solved: <span className="text-foreground font-medium">{solved}</span></span>
          </div>

          <div className="rounded-2xl border border-border/30 bg-card/60 py-8 text-center">
            <p className="font-display text-4xl font-bold tracking-[0.3em] text-primary uppercase">{scrambled}</p>
          </div>

          <form onSubmit={submitGuess} className="flex gap-2">
            <Input
              autoFocus
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Your answer"
              className="bg-card/60 border-border/30"
            />
            <Button type="submit">Go</Button>
            <Button type="button" variant="ghost" size="icon" onClick={skip} title="Skip">
              <SkipForward className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}

      {finished && (
        <div className={`rounded-2xl border p-6 text-center animate-fade-in ${cleared ? "border-emerald-500/30 bg-emerald-500/10" : "border-border/30 bg-card/60"}`}>
          <Trophy className={`w-8 h-8 mx-auto mb-2 ${cleared ? "text-emerald-400" : "text-muted-foreground"}`} />
          <p className="text-lg font-display font-semibold text-foreground">
            Time! {solved} {solved === 1 ? "word" : "words"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {cleared ? `Level ${level} cleared.` : `Solve ${goal} to clear level ${level}.`}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button variant="outline" onClick={start}>Play again</Button>
            {cleared && hasNext && (
              <Button onClick={() => { setLevel((l) => l + 1); setFinished(false); }}>
                Level {level + 1} <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
