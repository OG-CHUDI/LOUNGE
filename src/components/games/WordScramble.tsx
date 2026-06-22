import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Trophy, SkipForward, Type } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const WORDS = [
  "lounge", "coffee", "puzzle", "garden", "rocket", "planet", "guitar", "wonder",
  "bridge", "castle", "forest", "island", "marble", "orange", "pencil", "rabbit",
  "silver", "tunnel", "violet", "window", "anchor", "breeze", "candle", "dragon",
  "feather",
];

const ROUND_SECONDS = 60;

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

const pickWord = (exclude?: string) => {
  let w = WORDS[Math.floor(Math.random() * WORDS.length)];
  let guard = 0;
  while (w === exclude && guard < 10) {
    w = WORDS[Math.floor(Math.random() * WORDS.length)];
    guard++;
  }
  return w;
};

export default function WordScramble() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [solved, setSolved] = useState(0);
  const [word, setWord] = useState("");
  const [scrambled, setScrambled] = useState("");
  const [guess, setGuess] = useState("");
  const submitted = useRef(false);

  const nextWord = useCallback((prev?: string) => {
    const w = pickWord(prev);
    setWord(w);
    setScrambled(scramble(w));
    setGuess("");
  }, []);

  const start = () => {
    setSolved(0);
    setSeconds(ROUND_SECONDS);
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
    if (!user) return;
    void (async () => {
      const { error } = await supabase.from("game_scores").insert({
        game_key: "word-scramble",
        user_id: user.id,
        score: solved,
        detail: { words: solved },
      });
      if (error) {
        toast.error("Couldn't save your score.");
      } else {
        toast.success(`${solved} ${solved === 1 ? "word" : "words"} saved`);
        queryClient.invalidateQueries({ queryKey: ["leaderboard", "word-scramble"] });
      }
    })();
  }, [finished, solved, user, queryClient]);

  const submitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playing) return;
    if (guess.trim().toLowerCase() === word.toLowerCase()) {
      setSolved((s) => s + 1);
      nextWord(word);
    } else {
      setGuess("");
    }
  };

  const skip = () => {
    if (!playing) return;
    nextWord(word);
  };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      {!playing && !finished && (
        <div className="rounded-2xl border border-border/30 bg-card/60 p-8 text-center">
          <Type className="w-8 h-8 text-fuchsia-300 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-lg font-display font-semibold text-foreground">Word Scramble</p>
          <p className="text-sm text-muted-foreground mt-1">Unscramble as many words as you can in {ROUND_SECONDS} seconds.</p>
          <Button className="mt-4" onClick={start}>Start</Button>
        </div>
      )}

      {playing && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-4 h-4" /> <span className={`tabular-nums font-medium ${seconds <= 10 ? "text-red-400" : "text-foreground"}`}>{seconds}s</span>
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
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center animate-fade-in">
          <Trophy className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-lg font-display font-semibold text-foreground">Time! {solved} {solved === 1 ? "word" : "words"}</p>
          <Button className="mt-4" onClick={start}>Play again</Button>
        </div>
      )}
    </div>
  );
}
