import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Zap, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const ROUNDS = 5;
const MISS_MS = 1000; // penalty value for clicking too early

type Phase = "idle" | "waiting" | "ready" | "done";

export default function ReactionRush() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0); // completed rounds
  const [results, setResults] = useState<number[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const greenAt = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitted = useRef(false);

  const clearTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const startRound = useCallback(() => {
    setPhase("waiting");
    setLast(null);
    const delay = 1000 + Math.random() * 2000;
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      greenAt.current = Date.now();
      setPhase("ready");
    }, delay);
  }, []);

  const begin = () => {
    setResults([]);
    setRound(0);
    submitted.current = false;
    startRound();
  };

  const recordRound = (ms: number) => {
    const next = [...results, ms];
    setResults(next);
    setLast(ms);
    const completed = round + 1;
    setRound(completed);
    if (completed >= ROUNDS) {
      setPhase("done");
    } else {
      setPhase("idle");
    }
  };

  const handleTap = () => {
    if (phase === "waiting") {
      // Clicked too early → miss.
      clearTimer();
      recordRound(MISS_MS);
    } else if (phase === "ready") {
      const ms = Date.now() - greenAt.current;
      recordRound(ms);
    }
  };

  useEffect(() => () => clearTimer(), []);

  const avgMs = results.length
    ? Math.round(results.reduce((a, b) => a + b, 0) / results.length)
    : 0;

  useEffect(() => {
    if (phase !== "done" || submitted.current) return;
    submitted.current = true;
    const score = Math.max(0, Math.round(1000 - avgMs));
    if (!user) return;
    void (async () => {
      const { error } = await supabase.from("game_scores").insert({
        game_key: "reaction-rush",
        user_id: user.id,
        score,
        detail: { avgMs },
      });
      if (error) {
        toast.error("Couldn't save your score.");
      } else {
        toast.success(`Avg ${avgMs}ms saved`);
        queryClient.invalidateQueries({ queryKey: ["leaderboard", "reaction-rush"] });
      }
    })();
  }, [phase, avgMs, user, queryClient]);

  const panelBase =
    "w-full rounded-2xl flex flex-col items-center justify-center text-center transition-colors select-none";
  const panelHeight = { minHeight: 280 };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Round <span className="text-foreground font-medium">{Math.min(round + (phase === "done" ? 0 : 1), ROUNDS)}/{ROUNDS}</span></span>
        {last !== null && (
          <span>{last >= MISS_MS && phase !== "ready" ? "Too soon!" : `${last}ms`}</span>
        )}
      </div>

      {phase === "idle" && round === 0 && (
        <button onClick={begin} className={`${panelBase} bg-card/60 border border-border/30 hover:bg-card`} style={panelHeight}>
          <Zap className="w-10 h-10 text-lime-400 mb-3" />
          <p className="text-lg font-display font-semibold text-foreground">Reaction Rush</p>
          <p className="text-sm text-muted-foreground mt-1 px-6">Wait for green, then tap as fast as you can. 5 rounds.</p>
          <span className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Start</span>
        </button>
      )}

      {phase === "idle" && round > 0 && (
        <button onClick={startRound} className={`${panelBase} bg-card/60 border border-border/30 hover:bg-card`} style={panelHeight}>
          <p className="text-base text-muted-foreground">Last: <span className="text-foreground font-medium">{last}ms</span></p>
          <p className="text-lg font-display font-semibold text-foreground mt-2">Tap to start round {round + 1}</p>
        </button>
      )}

      {phase === "waiting" && (
        <button onClick={handleTap} className={`${panelBase} bg-red-600/80 text-white`} style={panelHeight}>
          <p className="text-2xl font-display font-bold">Wait…</p>
          <p className="text-sm opacity-80 mt-1">Don't tap until it turns green</p>
        </button>
      )}

      {phase === "ready" && (
        <button onClick={handleTap} className={`${panelBase} bg-emerald-500 text-white`} style={panelHeight}>
          <p className="text-3xl font-display font-bold">TAP!</p>
        </button>
      )}

      {phase === "done" && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center animate-fade-in">
          <Trophy className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-lg font-display font-semibold text-foreground">Average: {avgMs}ms</p>
          <p className="text-xs text-muted-foreground mt-1">{results.map((r) => `${r}ms`).join(" · ")}</p>
          <Button className="mt-4" onClick={begin}>Play again</Button>
        </div>
      )}
    </div>
  );
}
