import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadToBucket } from "@/lib/storage";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { initials } from "@/hooks/useTeam";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Plus, Loader2, Mic, Play, Square, Trash2, Layers } from "lucide-react";
import RecorderControls from "@/components/airwaves/RecorderControls";
import AudioPlayer from "@/components/airwaves/AudioPlayer";

const MAX_SECONDS = 30;

interface TrackRow {
  id: string;
  title: string;
  author_id: string;
  created_at: string | null;
  author: { name: string | null; avatar_url: string | null } | null;
}

interface LineRow {
  id: string;
  track_id: string;
  author_id: string;
  audio_url: string;
  duration_seconds: number | null;
  created_at: string | null;
  author: { name: string | null; avatar_url: string | null } | null;
}

export default function AirwavesOpenVerse() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const recorder = useAudioRecorder(MAX_SECONDS);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  // Sequential "play all" engine
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);

  const { data: tracks, isLoading } = useQuery({
    queryKey: ["openverse-tracks"],
    queryFn: async (): Promise<TrackRow[]> => {
      const { data, error } = await supabase
        .from("openverse_tracks")
        .select("id, title, author_id, created_at, author:profiles!openverse_tracks_author_id_fkey(name, avatar_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TrackRow[];
    },
    staleTime: 30_000,
  });

  const { data: allLines } = useQuery({
    queryKey: ["openverse-line-index"],
    queryFn: async () => {
      const { data, error } = await supabase.from("openverse_lines").select("track_id");
      if (error) throw error;
      return (data ?? []) as { track_id: string }[];
    },
    staleTime: 30_000,
  });
  const countByTrack = (allLines ?? []).reduce<Record<string, number>>((acc, l) => {
    acc[l.track_id] = (acc[l.track_id] ?? 0) + 1;
    return acc;
  }, {});

  const { data: lines } = useQuery({
    queryKey: ["openverse-lines", selectedId],
    enabled: !!selectedId,
    queryFn: async (): Promise<LineRow[]> => {
      const { data, error } = await supabase
        .from("openverse_lines")
        .select("id, track_id, author_id, audio_url, duration_seconds, created_at, author:profiles!openverse_lines_author_id_fkey(name, avatar_url)")
        .eq("track_id", selectedId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as LineRow[];
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("open-verse")
      .on("postgres_changes", { event: "*", schema: "public", table: "openverse_tracks" }, () =>
        queryClient.invalidateQueries({ queryKey: ["openverse-tracks"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "openverse_lines" }, () => {
        queryClient.invalidateQueries({ queryKey: ["openverse-lines"] });
        queryClient.invalidateQueries({ queryKey: ["openverse-line-index"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Stop sequential playback when leaving a track / unmounting.
  const stopAll = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingIdx(null);
  };
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const playFrom = (list: LineRow[], i: number) => {
    if (i >= list.length) { stopAll(); return; }
    audioRef.current?.pause();
    const a = new Audio(list[i].audio_url);
    audioRef.current = a;
    setPlayingIdx(i);
    a.onended = () => playFrom(list, i + 1);
    void a.play().catch(() => stopAll());
  };

  const createTrack = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const t = newTitle.trim();
      if (!t) throw new Error("Give the track a title");
      const { data, error } = await supabase.from("openverse_tracks").insert({ title: t, author_id: user.id }).select("id").single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: (id) => {
      toast.success("Track started — add the first line.");
      setNewTitle("");
      queryClient.invalidateQueries({ queryKey: ["openverse-tracks"] });
      setSelectedId(id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create track"),
  });

  const addLine = useMutation({
    mutationFn: async () => {
      if (!user || !selectedId) throw new Error("Not ready");
      if (!recorder.blob) throw new Error("Record your line first");
      const url = await uploadToBucket("airwaves", `${user.id}/openverse/${Date.now()}.webm`, recorder.blob, recorder.blob.type);
      const { error } = await supabase.from("openverse_lines").insert({
        track_id: selectedId,
        author_id: user.id,
        audio_url: url,
        duration_seconds: recorder.seconds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Line added.");
      recorder.reset();
      queryClient.invalidateQueries({ queryKey: ["openverse-lines", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["openverse-line-index"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add line"),
  });

  const removeLine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("openverse_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["openverse-lines", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["openverse-line-index"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  const removeTrack = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("openverse_tracks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      stopAll();
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["openverse-tracks"] });
      queryClient.invalidateQueries({ queryKey: ["openverse-line-index"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  const selectedTrack = (tracks ?? []).find((t) => t.id === selectedId) ?? null;

  // ── Track detail ──
  if (selectedTrack) {
    const list = lines ?? [];
    return (
      <div className="space-y-6 animate-fade-in">
        <button onClick={() => { stopAll(); setSelectedId(null); }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> All tracks
        </button>

        <Card className="p-5 bg-card/60 border-border/30 rounded-2xl flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-foreground truncate">{selectedTrack.title}</h2>
            <p className="text-xs text-muted-foreground">Started by {selectedTrack.author?.name ?? "someone"} · {list.length} line{list.length === 1 ? "" : "s"}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {playingIdx !== null ? (
              <Button variant="outline" className="rounded-xl gap-2" onClick={stopAll}><Square className="w-4 h-4" /> Stop</Button>
            ) : (
              <Button className="rounded-xl gap-2" disabled={list.length === 0} onClick={() => playFrom(list, 0)}><Play className="w-4 h-4" /> Play all</Button>
            )}
            {selectedTrack.author_id === user?.id && (
              <Button variant="outline" size="icon" className="rounded-xl" title="Delete track" onClick={() => removeTrack.mutate(selectedTrack.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </Card>

        <div className="space-y-3">
          {list.map((l, i) => (
            <Card key={l.id} className={`p-3 bg-card/60 border-border/30 rounded-2xl flex items-center gap-3 ${playingIdx === i ? "ring-2 ring-primary/40" : ""}`}>
              <span className="text-xs font-semibold text-muted-foreground tabular-nums w-5 text-center shrink-0">{i + 1}</span>
              <Avatar className="w-7 h-7 ring-1 ring-border/30 shrink-0">
                <AvatarImage src={l.author?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-[9px]">{initials(l.author?.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground mb-1 truncate">{l.author?.name ?? "Team member"}</p>
                <AudioPlayer src={l.audio_url} durationSeconds={l.duration_seconds} />
              </div>
              {l.author_id === user?.id && (
                <button onClick={() => removeLine.mutate(l.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0" title="Remove line">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </Card>
          ))}
          {list.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No lines yet — drop the first one.</p>}
        </div>

        {/* Add a line */}
        <Card className="p-4 bg-card/60 border-border/30 rounded-2xl space-y-3 max-w-xl">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-foreground">Add your line</h3>
            <span className="text-xs text-muted-foreground">up to {MAX_SECONDS}s</span>
          </div>
          <RecorderControls recorder={recorder} maxSeconds={MAX_SECONDS} label="Record line" />
          {recorder.blob && (
            <div className="flex justify-end">
              <Button onClick={() => addLine.mutate()} disabled={addLine.isPending} className="rounded-xl">
                {addLine.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                Add line
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ── Tracks list ──
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Layers className="w-6 h-6 text-primary" strokeWidth={1.5} /> Open Verse
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Build a track together, one line at a time. Start a cypher, a poem, a story — anyone can add the next bar.
        </p>
      </div>

      <Card className="p-4 bg-card/60 border-border/30 rounded-2xl flex items-center gap-2 max-w-xl">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New track title…"
          onKeyDown={(e) => e.key === "Enter" && !createTrack.isPending && (e.preventDefault(), createTrack.mutate())}
          className="bg-background/50"
        />
        <Button onClick={() => createTrack.mutate()} disabled={createTrack.isPending || !newTitle.trim()} className="rounded-xl shrink-0">
          {createTrack.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
          Start
        </Button>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : tracks && tracks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tracks.map((t) => (
            <Card
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className="p-5 bg-card/60 border-border/30 rounded-2xl cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground truncate">{t.title}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t.author?.name ?? "Someone"} · {countByTrack[t.id] ?? 0} line{(countByTrack[t.id] ?? 0) === 1 ? "" : "s"}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-10 bg-card/40 border-border/20 text-center">
          <Layers className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No tracks yet — start the first one above.</p>
        </Card>
      )}
    </div>
  );
}
