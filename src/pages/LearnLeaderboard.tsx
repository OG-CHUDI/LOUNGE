import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  type EntryRow,
  type TeaserToday,
  streaksByUser,
  weeklyStandings,
  todayStr,
  addDays,
  formatClock,
} from "@/lib/teasers";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trophy,
  Clock,
  Lightbulb,
  Send,
  Check,
  Loader2,
  Flame,
  Play,
  ShieldAlert,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Stage = "loading" | "none" | "idle" | "running" | "solved" | "forfeited";

const initials = (name: string | null | undefined) =>
  (name ?? "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

export default function LearnLeaderboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = todayStr();

  const [stage, setStage] = useState<Stage>("loading");
  const [answer, setAnswer] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);

  // ── Today's teaser (answer never leaves the server) ───────
  const { data: teaser } = useQuery({
    queryKey: ["today-teaser"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_today_teaser");
      if (error) throw error;
      return (data ?? null) as TeaserToday | null;
    },
    staleTime: 300_000,
  });

  // ── Recent entries (drives live board, streaks, weekly) ───
  const { data: entries } = useQuery({
    queryKey: ["leaderboard-entries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leaderboard_entries")
        .select("*, user:profiles!leaderboard_entries_user_id_fkey(id,name,avatar_url)")
        .gte("teaser_date", addDays(today, -40))
        .order("solve_seconds", { ascending: true });
      return (data ?? []) as unknown as EntryRow[];
    },
    refetchInterval: 12_000, // keep the board "live"
    staleTime: 5_000,
  });

  const lsKey = teaser ? `teaser-state:${teaser.id}` : null;

  // Decide the initial stage when the teaser loads.
  useEffect(() => {
    if (teaser === undefined) return;
    if (teaser === null) {
      setStage("none");
      return;
    }
    if (teaser.solved) {
      setStage("solved");
      setElapsed(teaser.solve_seconds ?? 0);
      return;
    }
    const saved = lsKey ? localStorage.getItem(lsKey) : null;
    if (saved === "forfeited" || saved === "started") {
      // "started" means they reloaded mid-attempt — that counts as leaving.
      if (saved === "started") localStorage.setItem(lsKey!, "forfeited");
      setStage("forfeited");
    } else {
      setStage("idle");
    }
  }, [teaser, lsKey]);

  const forfeit = useCallback(() => {
    setStage((s) => {
      if (s !== "running") return s;
      if (lsKey) localStorage.setItem(lsKey, "forfeited");
      return "forfeited";
    });
  }, [lsKey]);

  // Timer + anti-cheat lock while solving.
  useEffect(() => {
    if (stage !== "running") return;
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - startRef.current) / 1000)), 1000);

    // Only a real tab switch / minimise voids the attempt — not an alt-tab to
    // another app or clicking the address bar.
    const onHide = () => {
      if (document.hidden) forfeit();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [stage, forfeit]);

  const start = () => {
    if (!lsKey) return;
    localStorage.setItem(lsKey, "started");
    startRef.current = Date.now();
    setElapsed(0);
    setStage("running");
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!teaser) throw new Error("No teaser.");
      const { data, error } = await supabase.rpc("submit_teaser_answer", {
        p_teaser: teaser.id,
        p_answer: answer,
        p_solve_seconds: elapsed,
      });
      if (error) throw error;
      return data as { correct: boolean; already?: boolean };
    },
    onSuccess: (res) => {
      if (res.correct) {
        if (lsKey) localStorage.setItem(lsKey, "solved");
        setStage("solved");
        setAnswer("");
        queryClient.invalidateQueries({ queryKey: ["leaderboard-entries"] });
        queryClient.invalidateQueries({ queryKey: ["today-teaser"] });
      } else {
        setAnswer("");
        // Wrong answers don't end the attempt — keep going.
        toast.error("Not quite — try again.");
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't submit."),
  });

  // ── Derived board data ────────────────────────────────────
  const allEntries = useMemo(() => entries ?? [], [entries]);
  const todayBoard = useMemo(
    () => allEntries.filter((e) => e.teaser_date === today).sort((a, b) => a.solve_seconds - b.solve_seconds),
    [allEntries, today],
  );
  const streaks = useMemo(() => streaksByUser(allEntries, today), [allEntries, today]);
  const weekly = useMemo(() => weeklyStandings(allEntries, today), [allEntries, today]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Brain Teaser Leaderboard</h2>
        <p className="text-sm text-muted-foreground mt-1">A fresh puzzle every day. Solve fast, keep your streak.</p>
      </div>

      {/* Today's teaser */}
      <Card className="p-6 bg-card/60 border-border/30 shadow-lg shadow-black/10">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-muted-foreground font-medium">Today's Teaser</span>
          {stage === "running" && (
            <span className="ml-auto flex items-center gap-1.5 text-sm font-mono text-foreground">
              <Clock className="w-3.5 h-3.5" /> {formatClock(elapsed)}
            </span>
          )}
        </div>

        {stage === "loading" && (
          <div className="py-6 flex items-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…</div>
        )}

        {stage === "none" && (
          <div className="text-center py-8">
            <Lightbulb className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No teaser available right now. Check back shortly.</p>
          </div>
        )}

        {stage === "idle" && teaser && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/90 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Once you start, the timer runs and the puzzle is shown. <strong>Switching to another tab or minimising ends your attempt for today</strong> — no looking things up.
              </span>
            </div>
            <Button onClick={start} className="rounded-xl">
              <Play className="w-4 h-4 mr-1.5" /> Start today's teaser
            </Button>
          </div>
        )}

        {stage === "running" && teaser && (
          <div>
            <p className="font-display text-lg font-semibold text-foreground mb-4">{teaser.prompt}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (answer.trim()) submit.mutate();
              }}
              className="flex gap-3"
            >
              <Input
                autoFocus
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Your answer…"
                className="flex-1 h-11 rounded-xl bg-background/50 border-border/40"
              />
              <Button type="submit" disabled={submit.isPending || !answer.trim()} className="h-11 rounded-xl">
                {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-1.5" /> Submit</>}
              </Button>
            </form>
          </div>
        )}

        {stage === "solved" && (
          <div className="flex items-center gap-2 text-emerald-400 py-2">
            <Check className="w-4 h-4" />
            <span className="text-sm font-medium">
              Solved{elapsed ? ` in ${formatClock(elapsed)}` : ""}! You're on the board.
            </span>
          </div>
        )}

        {stage === "forfeited" && (
          <div className="flex items-center gap-2 text-amber-400 py-2">
            <ShieldAlert className="w-4 h-4" />
            <span className="text-sm font-medium">You left the tab — today's attempt is void. Come back tomorrow.</span>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live leaderboard */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="font-display text-sm font-semibold text-foreground">Today's Board</h3>
          </div>
          <Card className="bg-card/60 border-border/30 shadow-lg shadow-black/10 overflow-hidden">
            {todayBoard.length > 0 ? (
              <div className="divide-y divide-border/20">
                {todayBoard.map((entry, idx) => {
                  const isMe = entry.user_id === user?.id;
                  const streak = streaks.get(entry.user_id) ?? 0;
                  return (
                    <div
                      key={entry.id}
                      className={cn("flex items-center gap-4 px-5 py-3.5 transition-colors", isMe ? "bg-primary/5" : "hover:bg-muted/10")}
                    >
                      <div className="w-7 text-center">
                        {idx === 0 && <Trophy className="w-4 h-4 text-amber-400 inline" />}
                        {idx === 1 && <Trophy className="w-4 h-4 text-slate-400 inline" />}
                        {idx === 2 && <Trophy className="w-4 h-4 text-amber-700 inline" />}
                        {idx > 2 && <span className="text-sm font-medium text-muted-foreground">{idx + 1}</span>}
                      </div>
                      <Avatar className="w-8 h-8 ring-2 ring-border/30">
                        <AvatarImage src={entry.user?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">{initials(entry.user?.name)}</AvatarFallback>
                      </Avatar>
                      <span className={cn("flex-1 text-sm font-medium", isMe ? "text-primary" : "text-foreground")}>
                        {entry.user?.name}
                        {isMe && <span className="text-[10px] text-primary ml-2">(you)</span>}
                      </span>
                      {streak > 1 && (
                        <span className="flex items-center gap-1 text-xs text-orange-400" title={`${streak}-day streak`}>
                          <Flame className="w-3.5 h-3.5" /> {streak}
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-sm text-muted-foreground w-16 justify-end">
                        <Clock className="w-3 h-3" />
                        <span>{formatClock(entry.solve_seconds)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Trophy className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No one's solved it yet. Be the first!</p>
              </div>
            )}
          </Card>
        </div>

        {/* Weekly winners */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-4 h-4 text-amber-400" />
            <h3 className="font-display text-sm font-semibold text-foreground">This Week</h3>
          </div>
          <Card className="p-5 bg-card/60 border-border/30 shadow-lg shadow-black/10">
            {weekly.length > 0 ? (
              <div className="space-y-4">
                {/* Leader */}
                <div className="text-center pb-4 border-b border-border/20">
                  <div className="relative inline-block">
                    <Avatar className="w-14 h-14 ring-2 ring-amber-400/50 mx-auto">
                      <AvatarImage src={weekly[0].avatar_url ?? undefined} />
                      <AvatarFallback className="bg-amber-500/20 text-amber-300">{initials(weekly[0].name)}</AvatarFallback>
                    </Avatar>
                    <Crown className="w-5 h-5 text-amber-400 absolute -top-2 -right-1" />
                  </div>
                  <p className="font-display font-semibold text-foreground mt-2">{weekly[0].name}</p>
                  <p className="text-xs text-muted-foreground">
                    {weekly[0].solves} solve{weekly[0].solves === 1 ? "" : "s"} · leading this week
                  </p>
                </div>
                {/* Chasers */}
                <div className="space-y-2">
                  {weekly.slice(1, 5).map((w, i) => (
                    <div key={w.userId} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-4 text-center">{i + 2}</span>
                      <Avatar className="w-7 h-7 ring-1 ring-border/30">
                        <AvatarImage src={w.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-[10px]">{initials(w.name)}</AvatarFallback>
                      </Avatar>
                      <span className={cn("flex-1 text-sm", w.userId === user?.id ? "text-primary font-medium" : "text-foreground/90")}>
                        {w.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{w.solves}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground text-center pt-1">Winner announced Sunday.</p>
              </div>
            ) : (
              <div className="text-center py-6">
                <Crown className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No solves yet this week.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
