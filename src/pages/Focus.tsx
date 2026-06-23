import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Pause, Coffee, Users, Zap, RotateCcw, Plus, Minus, LogOut, UserPlus, User } from "lucide-react";
import { sendFocusAlert } from "@/lib/focusAlerts";

const WORK_MINUTES = 25;
const BREAK_MINUTES = 5;
const MIN_MINUTES = 5;
const MAX_MINUTES = 120;
const STEP_MINUTES = 5;

type Mode = "idle" | "host" | "guest" | "solo";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function initials(name?: string | null): string {
  return (name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("");
}

export default function Focus() {
  const { user, profile, setFocusMode } = useAuth();
  const queryClient = useQueryClient();

  const [durationMinutes, setDurationMinutes] = useState(WORK_MINUTES);
  const [timerSeconds, setTimerSeconds] = useState(WORK_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<"work" | "break">("work");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [guestEndsAt, setGuestEndsAt] = useState<string | null>(null);
  const [guestTotal, setGuestTotal] = useState(0);

  const { data: focusUsers } = useQuery({
    queryKey: ["focus-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("focus_status")
        .select("*, user:profiles!focus_status_user_id_fkey(id, name, avatar_url)")
        .eq("is_focusing", true);
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  const { data: activeSessions } = useQuery({
    queryKey: ["active-pomodoro-sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pomodoro_sessions")
        .select(
          "*, host:profiles!pomodoro_sessions_host_id_fkey(id, name, avatar_url), participants:pomodoro_participants(user_id)"
        )
        .eq("status", "active");
      return data ?? [];
    },
    refetchInterval: 10_000,
  });

  const { data: participants } = useQuery({
    queryKey: ["pomodoro-participants", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pomodoro_participants")
        .select("user_id, user:profiles!pomodoro_participants_user_id_fkey(id, name, avatar_url)")
        .eq("session_id", sessionId);
      return data ?? [];
    },
    refetchInterval: 8_000,
  });

  // Timer effect
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      // Guest timers are slaved to the host's end time so everyone stays in sync.
      if (mode === "guest") {
        if (!guestEndsAt) return;
        const remaining = Math.max(0, Math.floor((new Date(guestEndsAt).getTime() - Date.now()) / 1000));
        setTimerSeconds(remaining);
        if (remaining <= 0) setIsRunning(false);
        return;
      }

      setTimerSeconds((prev) => {
        if (prev <= 1) {
          // Phase complete
          if (phase === "work") {
            setPhase("break");
            return BREAK_MINUTES * 60;
          }
          setPhase("work");
          setIsRunning(false);
          return durationMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, phase, mode, guestEndsAt, durationMinutes]);

  const adjustDuration = (delta: number) => {
    if (mode !== "idle") return;
    setDurationMinutes((d) => {
      const next = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, d + delta));
      setTimerSeconds(next * 60);
      return next;
    });
  };

  // Solo: focus mode on, local timer, no shared session and no team alert.
  const startSolo = async () => {
    if (!user) return;
    setMode("solo");
    setPhase("work");
    setTimerSeconds(durationMinutes * 60);
    setIsRunning(true);
    await setFocusMode(true);
    queryClient.invalidateQueries({ queryKey: ["focus-users"] });
  };

  const startSession = async () => {
    if (!user) return;
    const total = durationMinutes * 60;
    const endsAt = new Date(Date.now() + total * 1000).toISOString();

    setMode("host");
    setPhase("work");
    setTimerSeconds(total);
    setIsRunning(true);

    const { data } = await supabase
      .from("pomodoro_sessions")
      .insert({
        host_id: user.id,
        phase: "work",
        started_at: new Date().toISOString(),
        ends_at: endsAt,
        status: "active",
      })
      .select()
      .single();

    if (data) {
      setSessionId(data.id);
      await supabase
        .from("pomodoro_participants")
        .upsert({ session_id: data.id, user_id: user.id }, { onConflict: "session_id,user_id" });

      // Open & ephemeral: ping everyone currently in the app — no notification.
      sendFocusAlert({
        hostName: profile?.name ?? "Someone",
        hostId: user.id,
        sessionId: data.id,
        durationMinutes,
      });
    }

    await setFocusMode(true);
    queryClient.invalidateQueries({ queryKey: ["focus-users"] });
    queryClient.invalidateQueries({ queryKey: ["active-pomodoro-sessions"] });
  };

  const joinSession = async (s: any) => {
    if (!user || mode !== "idle") return;
    const ends = s.ends_at ? new Date(s.ends_at).getTime() : Date.now();
    const start = s.started_at ? new Date(s.started_at).getTime() : ends;

    setGuestTotal(Math.max(0, Math.floor((ends - start) / 1000)));
    setGuestEndsAt(s.ends_at);
    setTimerSeconds(Math.max(0, Math.floor((ends - Date.now()) / 1000)));
    setPhase(s.phase === "break" ? "break" : "work");
    setSessionId(s.id);
    setMode("guest");
    setIsRunning(true);

    await supabase
      .from("pomodoro_participants")
      .upsert({ session_id: s.id, user_id: user.id }, { onConflict: "session_id,user_id" });

    await setFocusMode(true);
    queryClient.invalidateQueries({ queryKey: ["focus-users"] });
    queryClient.invalidateQueries({ queryKey: ["active-pomodoro-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["pomodoro-participants"] });
  };

  const pauseSession = () => setIsRunning(false);
  const resumeSession = () => setIsRunning(true);

  // Reset (host) / Leave (guest): tears down the session and returns to idle.
  const endSession = async () => {
    const wasHost = mode === "host";
    const sid = sessionId;

    setIsRunning(false);
    setSessionId(null);
    setMode("idle");
    setGuestEndsAt(null);
    setGuestTotal(0);
    setPhase("work");
    setTimerSeconds(durationMinutes * 60);

    if (sid && user) {
      if (wasHost) {
        await supabase.from("pomodoro_sessions").update({ status: "completed" }).eq("id", sid);
      }
      await supabase.from("pomodoro_participants").delete().eq("session_id", sid).eq("user_id", user.id);
    }

    await setFocusMode(false);
    queryClient.invalidateQueries({ queryKey: ["focus-users"] });
    queryClient.invalidateQueries({ queryKey: ["active-pomodoro-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["pomodoro-participants"] });
  };

  const totalSeconds =
    mode === "guest"
      ? guestTotal || durationMinutes * 60
      : phase === "work"
        ? durationMinutes * 60
        : BREAK_MINUTES * 60;
  const progress = totalSeconds > 0 ? (timerSeconds / totalSeconds) * 100 : 0;

  const statusLabel =
    mode === "idle" ? "READY" : !isRunning ? "PAUSED" : phase === "work" ? "FOCUSING" : "ON BREAK";

  const joinable = (activeSessions ?? []).filter((s: any) => {
    if (s.id === sessionId) return false;
    if (s.ends_at && new Date(s.ends_at).getTime() < Date.now()) return false;
    const ids = (s.participants ?? []).map((p: any) => p.user_id);
    if (user && ids.includes(user.id)) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Focus Lounge</h2>
        <p className="text-sm text-muted-foreground mt-1">Deep work sessions with the team.</p>
      </div>

      {/* Pomodoro Timer */}
      <Card className="p-8 bg-card/60 border-border/30 shadow-lg shadow-black/10 text-center max-w-md mx-auto">
        {/* Phase indicator */}
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-muted/20 border border-border/20 text-xs font-medium text-muted-foreground">
          {phase === "work" ? (
            <>
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              {mode === "host" || mode === "guest" ? "Group Focus Session" : "Focus Session"}
            </>
          ) : (
            <>
              <Coffee className="w-3.5 h-3.5 text-amber-400" />
              Break Time
            </>
          )}
        </div>

        {/* Timer display */}
        <div className="relative w-48 h-48 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 192 192">
            <circle cx="96" cy="96" r="88" fill="none" stroke="currentColor" className="text-muted/10" strokeWidth="6" />
            <circle
              cx="96"
              cy="96"
              r="88"
              fill="none"
              stroke="currentColor"
              className={phase === "work" ? "text-indigo-400" : "text-amber-400"}
              strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 88}`}
              strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress / 100)}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-4xl font-bold text-foreground">{formatTime(timerSeconds)}</span>
            <span
              className={`mt-1 text-[11px] font-semibold tracking-widest ${
                mode === "idle" || !isRunning ? "text-muted-foreground" : "text-indigo-400"
              }`}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Duration stepper (idle only) */}
        {mode === "idle" && (
          <div className="flex items-center justify-center gap-4 mb-6">
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              onClick={() => adjustDuration(-STEP_MINUTES)}
              disabled={durationMinutes <= MIN_MINUTES}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <div className="min-w-[88px]">
              <div className="font-display text-lg font-bold text-foreground">{durationMinutes} min</div>
              <div className="text-xs text-muted-foreground">Session length</div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              onClick={() => adjustDuration(STEP_MINUTES)}
              disabled={durationMinutes >= MAX_MINUTES}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {mode === "idle" && (
            <>
              <Button onClick={startSolo} variant="outline" className="h-12 px-5 rounded-xl gap-2">
                <User className="w-4 h-4" />
                Solo focus
              </Button>
              <Button onClick={startSession} className="h-12 px-5 rounded-xl gap-2">
                <Users className="w-4 h-4" />
                Group session
              </Button>
            </>
          )}

          {(mode === "host" || mode === "solo") && (
            <>
              {isRunning ? (
                <Button onClick={pauseSession} variant="outline" className="h-12 px-6 rounded-xl gap-2">
                  <Pause className="w-4 h-4" />
                  Pause
                </Button>
              ) : (
                <Button onClick={resumeSession} className="h-12 px-6 rounded-xl gap-2">
                  <Play className="w-4 h-4" />
                  Resume
                </Button>
              )}
              <Button
                onClick={endSession}
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-xl"
                title={mode === "host" ? "Reset & end session" : "End session"}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </>
          )}

          {mode === "guest" && (
            <Button onClick={endSession} variant="outline" className="h-12 px-6 rounded-xl gap-2">
              <LogOut className="w-4 h-4" />
              Leave session
            </Button>
          )}
        </div>

        {mode === "idle" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Solo keeps it to you. A <span className="text-foreground font-medium">group session</span> is open to the team — everyone in the app gets a quick heads-up and can join your timer.
          </p>
        )}

        {/* Participants in the current session */}
        {mode !== "idle" && participants && participants.length > 0 && (
          <div className="mt-6 pt-5 border-t border-border/20">
            <p className="text-xs text-muted-foreground mb-3">
              {participants.length} {participants.length === 1 ? "person" : "people"} in this session
            </p>
            <div className="flex items-center justify-center -space-x-2">
              {(participants as any[]).map((p: any) => (
                <Avatar key={p.user_id} className="w-8 h-8 ring-2 ring-card">
                  <AvatarImage src={p.user?.avatar_url} />
                  <AvatarFallback className="bg-indigo-500/20 text-indigo-400 text-xs">
                    {initials(p.user?.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Group sessions to join */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-4 h-4 text-indigo-400" />
          <h3 className="font-display text-sm font-semibold text-foreground">Group sessions</h3>
          <span className="text-xs text-muted-foreground">({joinable.length})</span>
        </div>

        {joinable.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {joinable.map((s: any) => {
              const count = (s.participants ?? []).length;
              const remaining = s.ends_at
                ? Math.max(0, Math.floor((new Date(s.ends_at).getTime() - Date.now()) / 1000))
                : 0;
              return (
                <Card
                  key={s.id}
                  className="p-4 bg-card/60 border-border/30 shadow-sm flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-9 h-9 ring-2 ring-indigo-500/30 shrink-0">
                      <AvatarImage src={s.host?.avatar_url} />
                      <AvatarFallback className="bg-indigo-500/20 text-indigo-400 text-xs">
                        {initials(s.host?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {s.host?.name ?? "Someone"}'s session
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(remaining)} left · {count} {count === 1 ? "person" : "people"}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-xl gap-1.5 shrink-0"
                    onClick={() => joinSession(s)}
                    disabled={mode !== "idle"}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Join
                  </Button>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-6 bg-card/40 border-border/20 text-center">
            <Users className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {mode === "idle"
                ? "No group sessions running. Start one and the team can join you."
                : "No other sessions to join right now."}
            </p>
          </Card>
        )}
      </div>

      {/* Who's focusing */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-indigo-400" />
          <h3 className="font-display text-sm font-semibold text-foreground">Who's in focus right now</h3>
          <span className="text-xs text-muted-foreground">({focusUsers?.length ?? 0})</span>
        </div>

        {focusUsers && focusUsers.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {(focusUsers as any[]).map((fu: any) => (
              <div
                key={fu.user_id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-card/60 border border-border/30 shadow-sm"
              >
                <div className="relative">
                  <Avatar className="w-8 h-8 ring-2 ring-indigo-500/30">
                    <AvatarImage src={fu.user?.avatar_url} />
                    <AvatarFallback className="bg-indigo-500/20 text-indigo-400 text-xs">
                      {initials(fu.user?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-indigo-400 border-2 border-card" />
                </div>
                <span className="text-sm font-medium text-foreground">{fu.user?.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <Card className="p-6 bg-card/40 border-border/20 text-center">
            <Zap className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No one is focusing right now. You could be the first!</p>
          </Card>
        )}
      </div>
    </div>
  );
}
