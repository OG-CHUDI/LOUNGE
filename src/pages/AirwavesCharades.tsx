import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadToBucket } from "@/lib/storage";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useTeam, initials } from "@/hooks/useTeam";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Send, Trash2, Drama, Eye, Check, Trophy } from "lucide-react";
import RecorderControls from "@/components/airwaves/RecorderControls";
import AudioPlayer from "@/components/airwaves/AudioPlayer";

const MAX_SECONDS = 30;

interface RoundRow {
  id: string;
  author_id: string;
  clue_audio_url: string;
  revealed_answer: string | null;
  solved_by: string | null;
  solved_at: string | null;
  created_at: string | null;
  author: { name: string | null; avatar_url: string | null } | null;
  solver: { name: string | null } | null;
}

interface GuessRow {
  id: string;
  round_id: string;
  user_id: string;
  guess: string;
  correct: boolean;
  created_at: string | null;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

function RoundCard({ round }: { round: RoundRow }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: team } = useTeam();
  const [guess, setGuess] = useState("");

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    (team ?? []).forEach((t) => m.set(t.id, t.name ?? "Team member"));
    return m;
  }, [team]);

  const { data: guesses } = useQuery({
    queryKey: ["charades-guesses", round.id],
    queryFn: async (): Promise<GuessRow[]> => {
      const { data, error } = await supabase
        .from("charades_guesses")
        .select("id, round_id, user_id, guess, correct, created_at")
        .eq("round_id", round.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as GuessRow[];
    },
    staleTime: 15_000,
  });

  const solved = !!round.solved_by || !!round.revealed_answer;
  const mine = round.author_id === user?.id;

  const submitGuess = useMutation({
    mutationFn: async () => {
      const g = guess.trim();
      if (!g) throw new Error("Type a guess");
      const { data, error } = await supabase.rpc("submit_charade_guess", { p_round: round.id, p_guess: g });
      if (error) throw error;
      return data as { correct: boolean; revealed: string | null };
    },
    onSuccess: (res) => {
      setGuess("");
      if (res.correct) toast.success("Correct! 🎉");
      else toast("Not quite — try again.");
      queryClient.invalidateQueries({ queryKey: ["charades-guesses", round.id] });
      queryClient.invalidateQueries({ queryKey: ["charades-rounds"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not submit"),
  });

  const reveal = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("reveal_charade", { p_round: round.id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["charades-rounds"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not reveal"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("charades_rounds").delete().eq("id", round.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["charades-rounds"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  return (
    <Card className="p-4 bg-card/60 border-border/30 rounded-2xl space-y-3">
      <div className="flex items-center gap-2">
        <Avatar className="w-6 h-6 ring-1 ring-border/30">
          <AvatarImage src={round.author?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-[9px]">{initials(round.author?.name)}</AvatarFallback>
        </Avatar>
        <span className="text-sm text-foreground truncate">{round.author?.name ?? "Someone"}'s clue</span>
        <span className="text-[11px] text-muted-foreground ml-auto">{relativeTime(round.created_at)}</span>
        {mine && (
          <button onClick={() => remove.mutate()} className="text-muted-foreground hover:text-destructive transition-colors" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AudioPlayer src={round.clue_audio_url} />

      {solved ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
          <Trophy className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <p className="text-sm text-foreground">
            Answer: <span className="font-semibold">{round.revealed_answer}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {round.solved_by ? `Guessed by ${nameById.get(round.solved_by) ?? "someone"}` : "Revealed by the author"}
          </p>
        </div>
      ) : mine ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Your clue is live — waiting for guesses.</p>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => reveal.mutate()}>
            <Eye className="w-3.5 h-3.5" /> Reveal
          </Button>
        </div>
      ) : (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitGuess.mutate();
          }}
        >
          <Input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Your guess…" className="bg-background/50" />
          <Button type="submit" size="icon" className="shrink-0" disabled={submitGuess.isPending || !guess.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      )}

      {guesses && guesses.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {guesses.slice(0, 6).map((g) => (
            <div key={g.id} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{nameById.get(g.user_id) ?? "Someone"}:</span>
              <span className={g.correct ? "text-emerald-400 font-medium flex items-center gap-1" : "text-foreground"}>
                {g.correct && <Check className="w-3 h-3" />}
                {/* hide the actual correct word from non-solvers until solved */}
                {g.correct && !solved ? "got it!" : g.guess}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function AirwavesCharades() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const recorder = useAudioRecorder(MAX_SECONDS);
  const [answer, setAnswer] = useState("");

  const { data: rounds, isLoading } = useQuery({
    queryKey: ["charades-rounds"],
    queryFn: async (): Promise<RoundRow[]> => {
      const { data, error } = await supabase
        .from("charades_rounds")
        .select("id, author_id, clue_audio_url, revealed_answer, solved_by, solved_at, created_at, author:profiles!charades_rounds_author_id_fkey(name, avatar_url), solver:profiles!charades_rounds_solved_by_fkey(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RoundRow[];
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("charades")
      .on("postgres_changes", { event: "*", schema: "public", table: "charades_rounds" }, () =>
        queryClient.invalidateQueries({ queryKey: ["charades-rounds"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "charades_guesses" }, () =>
        queryClient.invalidateQueries({ queryKey: ["charades-guesses"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!recorder.blob) throw new Error("Record your clue first");
      const a = answer.trim();
      if (!a) throw new Error("Set the secret answer");
      const url = await uploadToBucket("airwaves", `${user.id}/charades/${Date.now()}.webm`, recorder.blob, recorder.blob.type);
      const { error } = await supabase.rpc("create_charade", { p_clue_audio_url: url, p_answer: a });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clue posted — let them guess!");
      recorder.reset();
      setAnswer("");
      queryClient.invalidateQueries({ queryKey: ["charades-rounds"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not post"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Drama className="w-6 h-6 text-primary" strokeWidth={1.5} /> Audio Charades
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Describe a word or phrase out loud — without saying it. The team guesses; first correct answer wins.
        </p>
      </div>

      {/* Composer */}
      <Card className="p-4 bg-card/60 border-border/30 rounded-2xl space-y-3 max-w-xl">
        <RecorderControls recorder={recorder} maxSeconds={MAX_SECONDS} label="Record your clue" />
        {recorder.blob && (
          <div className="flex items-center gap-2">
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="The secret answer (hidden from everyone)"
              maxLength={60}
              className="bg-background/50"
            />
            <Button onClick={() => create.mutate()} disabled={create.isPending} className="rounded-xl shrink-0">
              {create.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              Post
            </Button>
          </div>
        )}
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : rounds && rounds.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {rounds.map((r) => <RoundCard key={r.id} round={r} />)}
        </div>
      ) : (
        <Card className="p-10 bg-card/40 border-border/20 text-center">
          <Drama className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No clues yet — record the first one.</p>
        </Card>
      )}
    </div>
  );
}
