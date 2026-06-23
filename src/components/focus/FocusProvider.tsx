import {
  createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { sendFocusAlert } from "@/lib/focusAlerts";

export const WORK_MINUTES = 25;
export const BREAK_MINUTES = 5;
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 120;
export const STEP_MINUTES = 5;

export type FocusMode = "idle" | "host" | "guest" | "solo";
type Phase = "work" | "break";

const STORAGE_KEY = "lounge:focus-session";

interface Snapshot {
  mode: FocusMode;
  phase: Phase;
  sessionId: string | null;
  durationMinutes: number;
  isRunning: boolean;
  endsAt: number | null; // absolute ms when the running phase ends
  frozen: number; // seconds left while paused/idle
  guestTotal: number;
}

function loadSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Snapshot;
    if (!s || s.mode === "idle") return null;
    return s;
  } catch {
    return null;
  }
}

interface FocusContextValue {
  mode: FocusMode;
  phase: Phase;
  isRunning: boolean;
  timerSeconds: number;
  durationMinutes: number;
  sessionId: string | null;
  guestTotal: number;
  adjustDuration: (delta: number) => void;
  startSolo: () => Promise<void>;
  startGroup: () => Promise<void>;
  // The joinable session row from the active-sessions query.
  joinSession: (s: { id: string; ends_at?: string | null; started_at?: string | null; phase?: string }) => Promise<void>;
  pause: () => void;
  resume: () => void;
  end: () => Promise<void>;
}

const FocusContext = createContext<FocusContextValue | null>(null);

export function FocusProvider({ children }: { children: ReactNode }) {
  const { user, profile, setFocusMode } = useAuth();
  const queryClient = useQueryClient();

  const initial = loadSnapshot();
  const now = Date.now();
  const initialDuration = initial?.durationMinutes ?? WORK_MINUTES;
  const initialRunning = !!initial?.isRunning && !!initial?.endsAt;
  const initialSeconds = initialRunning
    ? Math.max(0, Math.round(((initial!.endsAt as number) - now) / 1000))
    : (initial?.frozen ?? initialDuration * 60);

  const [mode, setMode] = useState<FocusMode>(initial?.mode ?? "idle");
  const [phase, setPhase] = useState<Phase>(initial?.phase ?? "work");
  const [sessionId, setSessionId] = useState<string | null>(initial?.sessionId ?? null);
  const [durationMinutes, setDurationMinutes] = useState(initialDuration);
  const [isRunning, setIsRunning] = useState(initialRunning);
  const [endsAt, setEndsAt] = useState<number | null>(initialRunning ? initial!.endsAt : null);
  const [timerSeconds, setTimerSeconds] = useState(initialSeconds);
  const [guestTotal, setGuestTotal] = useState(initial?.guestTotal ?? 0);

  // Keep the latest seconds readable from the persistence effect without
  // re-running it every tick.
  const secondsRef = useRef(timerSeconds);
  secondsRef.current = timerSeconds;

  // ── The clock. Lives here (always mounted) so it keeps running while you
  // navigate around the app. Driven by an absolute end time so it stays
  // accurate across navigation and reloads.
  useEffect(() => {
    if (!isRunning || !endsAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setTimerSeconds(remaining);
      if (remaining > 0) return;
      // Phase complete.
      if (mode === "guest") {
        setIsRunning(false);
        return;
      }
      if (phase === "work") {
        setPhase("break");
        setEndsAt(Date.now() + BREAK_MINUTES * 60 * 1000);
        setTimerSeconds(BREAK_MINUTES * 60);
      } else {
        setPhase("work");
        setIsRunning(false);
        setEndsAt(null);
        setTimerSeconds(durationMinutes * 60);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRunning, endsAt, mode, phase, durationMinutes]);

  // Persist on meaningful transitions (not every tick).
  useEffect(() => {
    if (mode === "idle") {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const snap: Snapshot = {
      mode, phase, sessionId, durationMinutes, isRunning, endsAt,
      frozen: secondsRef.current, guestTotal,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
    } catch {
      /* ignore */
    }
  }, [mode, phase, sessionId, durationMinutes, isRunning, endsAt, guestTotal]);

  // Keep the displayed time in step with the chosen length while idle.
  useEffect(() => {
    if (mode === "idle") setTimerSeconds(durationMinutes * 60);
  }, [durationMinutes, mode]);

  const adjustDuration = useCallback(
    (delta: number) => {
      if (mode !== "idle") return;
      setDurationMinutes((d) => Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, d + delta)));
    },
    [mode]
  );

  const startSolo = useCallback(async () => {
    if (!user) return;
    setMode("solo");
    setPhase("work");
    setEndsAt(Date.now() + durationMinutes * 60 * 1000);
    setTimerSeconds(durationMinutes * 60);
    setIsRunning(true);
    await setFocusMode(true);
    queryClient.invalidateQueries({ queryKey: ["focus-users"] });
  }, [user, durationMinutes, setFocusMode, queryClient]);

  const startGroup = useCallback(async () => {
    if (!user) return;
    const total = durationMinutes * 60;
    const endsAtIso = new Date(Date.now() + total * 1000).toISOString();

    setMode("host");
    setPhase("work");
    setEndsAt(Date.now() + total * 1000);
    setTimerSeconds(total);
    setIsRunning(true);

    const { data } = await supabase
      .from("pomodoro_sessions")
      .insert({
        host_id: user.id,
        phase: "work",
        started_at: new Date().toISOString(),
        ends_at: endsAtIso,
        status: "active",
      })
      .select()
      .single();

    if (data) {
      setSessionId(data.id);
      await supabase
        .from("pomodoro_participants")
        .upsert({ session_id: data.id, user_id: user.id }, { onConflict: "session_id,user_id" });
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
  }, [user, profile, durationMinutes, setFocusMode, queryClient]);

  const joinSession = useCallback<FocusContextValue["joinSession"]>(
    async (s) => {
      if (!user) return;
      const ends = s.ends_at ? new Date(s.ends_at).getTime() : Date.now();
      const start = s.started_at ? new Date(s.started_at).getTime() : ends;

      setGuestTotal(Math.max(0, Math.floor((ends - start) / 1000)));
      setEndsAt(ends);
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
    },
    [user, setFocusMode, queryClient]
  );

  const pause = useCallback(() => {
    setIsRunning(false);
    setEndsAt(null); // freeze; resume recomputes from the displayed seconds
  }, []);

  const resume = useCallback(() => {
    setEndsAt(Date.now() + secondsRef.current * 1000);
    setIsRunning(true);
  }, []);

  const end = useCallback(async () => {
    const wasHost = mode === "host";
    const sid = sessionId;

    setIsRunning(false);
    setEndsAt(null);
    setSessionId(null);
    setMode("idle");
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
  }, [mode, sessionId, durationMinutes, user, setFocusMode, queryClient]);

  return (
    <FocusContext.Provider
      value={{
        mode, phase, isRunning, timerSeconds, durationMinutes, sessionId, guestTotal,
        adjustDuration, startSolo, startGroup, joinSession, pause, resume, end,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus(): FocusContextValue {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocus must be used within a FocusProvider");
  return ctx;
}
