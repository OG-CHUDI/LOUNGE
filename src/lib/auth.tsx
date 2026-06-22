import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface Profile {
  id: string;
  name: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeskPet {
  user_id: string;
  species: string | null;
  pet_name: string | null;
  stage: string;
  xp: number;
  streak: number;
  happiness: number | null;
  fed_on: string | null;
  adopted_on: string | null;
  last_active_on: string;
  accessories: Record<string, unknown> | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  deskPet: DeskPet | null;
  isLoading: boolean;
  isFocusing: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  toggleFocusMode: () => Promise<void>;
  setFocusMode: (on: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PET_STAGES = ["egg", "hatchling", "juvenile", "adult", "elder"] as const;

function computeStage(xp: number): string {
  if (xp >= 400) return "elder";
  if (xp >= 200) return "adult";
  if (xp >= 80) return "juvenile";
  if (xp >= 20) return "hatchling";
  return "egg";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [deskPet, setDeskPet] = useState<DeskPet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFocusing, setIsFocusing] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) setProfile(data as Profile);
  }, []);

  const fetchDeskPet = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("desk_pets")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (data) {
      setDeskPet(data as DeskPet);
      return;
    }

    // Create desk pet for new user
    const { data: newPet, error } = await supabase
      .from("desk_pets")
      .insert({ user_id: userId })
      .select()
      .single();

    if (!error && newPet) setDeskPet(newPet as DeskPet);
  }, []);

  const fetchFocusStatus = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("focus_status")
      .select("is_focusing")
      .eq("user_id", userId)
      .single();
    if (data) setIsFocusing((data as { is_focusing: boolean }).is_focusing);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await fetchProfile(user.id);
    await fetchDeskPet(user.id);
    await fetchFocusStatus(user.id);
  }, [user, fetchProfile, fetchDeskPet, fetchFocusStatus]);

  // Initial session load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
        fetchDeskPet(s.user.id);
        fetchFocusStatus(s.user.id);
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
        fetchDeskPet(s.user.id);
        fetchFocusStatus(s.user.id);
      } else {
        setProfile(null);
        setDeskPet(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, fetchDeskPet, fetchFocusStatus]);

  // Daily XP grant on login
  useEffect(() => {
    if (!deskPet || !user) return;
    const today = new Date().toISOString().slice(0, 10);
    const lastActive = deskPet.last_active_on?.slice(0, 10);

    if (lastActive === today) return;

    const isConsecutiveDay = lastActive
      ? new Date(today).getTime() - new Date(lastActive).getTime() <= 86400000 * 2
      : false;

    const xpGain = 10;
    const newStreak = isConsecutiveDay ? deskPet.streak + 1 : 1;
    const newXp = deskPet.xp + xpGain + (newStreak >= 7 ? 5 : 0);
    const newStage = computeStage(newXp);

    supabase
      .from("desk_pets")
      .update({
        xp: newXp,
        streak: newStreak,
        stage: newStage,
        last_active_on: today,
      })
      .eq("user_id", user.id)
      .then(() => {
        setDeskPet((prev) =>
          prev ? { ...prev, xp: newXp, streak: newStreak, stage: newStage, last_active_on: today } : prev
        );
      });
  }, [deskPet?.user_id, user]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    // When email confirmation is enabled, signUp succeeds but no session is
    // returned until the user confirms via email.
    const needsConfirmation = !error && !data.session;
    return { error: error?.message ?? null, needsConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setDeskPet(null);
  }, []);

  const setFocusMode = useCallback(
    async (on: boolean) => {
      if (!user) return;
      setIsFocusing(on);

      await supabase.from("focus_status").upsert(
        { user_id: user.id, is_focusing: on, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    },
    [user]
  );

  const toggleFocusMode = useCallback(async () => {
    await setFocusMode(!isFocusing);
  }, [setFocusMode, isFocusing]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        deskPet,
        isLoading,
        isFocusing,
        signIn,
        signUp,
        signOut,
        toggleFocusMode,
        setFocusMode,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
