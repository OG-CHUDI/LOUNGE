import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Play, Pause, Coffee, Users, Zap, Timer } from "lucide-react";

const WORK_MINUTES = 25;
const BREAK_MINUTES = 5;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function Focus() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [timerSeconds, setTimerSeconds] = useState(WORK_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<"work" | "break">("work");
  const [sessionId, setSessionId] = useState<string | null>(null);

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

  // Timer effect
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          // Phase complete
          if (phase === "work") {
            setPhase("break");
            return BREAK_MINUTES * 60;
          } else {
            setPhase("work");
            setIsRunning(false);
            return WORK_MINUTES * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, phase]);

  const startSession = async () => {
    if (!user) return;
    setIsRunning(true);

    const { data } = await supabase
      .from("pomodoro_sessions")
      .insert({
        host_id: user.id,
        phase,
        started_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + timerSeconds * 1000).toISOString(),
        status: "active",
      })
      .select()
      .single();

    if (data) {
      setSessionId(data.id);
      // Join as participant
      await supabase.from("pomodoro_participants").insert({
        session_id: data.id,
        user_id: user.id,
      });
    }
  };

  const stopSession = () => {
    setIsRunning(false);
    if (sessionId) {
      supabase.from("pomodoro_sessions").update({ status: "completed" }).eq("id", sessionId);
    }
    setSessionId(null);
  };

  const progress = ((timerSeconds) / (phase === "work" ? WORK_MINUTES * 60 : BREAK_MINUTES * 60)) * 100;

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
              Focus Session
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
          <span className="absolute inset-0 flex items-center justify-center font-display text-4xl font-bold text-foreground">
            {formatTime(timerSeconds)}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {!isRunning ? (
            <Button
              onClick={startSession}
              className="h-12 px-6 rounded-xl gap-2"
            >
              <Play className="w-4 h-4" />
              {phase === "work" ? `Start ${WORK_MINUTES}m Focus` : `Start ${BREAK_MINUTES}m Break`}
            </Button>
          ) : (
            <Button
              onClick={stopSession}
              variant="outline"
              className="h-12 px-6 rounded-xl gap-2"
            >
              <Pause className="w-4 h-4" />
              End Session
            </Button>
          )}
        </div>
      </Card>

      {/* Who's focusing */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-indigo-400" />
          <h3 className="font-display text-sm font-semibold text-foreground">
            Who's in focus right now
          </h3>
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
                      {(fu.user?.name ?? "?").split(" ").map((n: string) => n[0]).join("")}
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
