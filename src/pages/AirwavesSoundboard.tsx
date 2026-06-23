import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadToBucket } from "@/lib/storage";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Upload, Volume2, Trash2, AudioLines } from "lucide-react";
import RecorderControls from "@/components/airwaves/RecorderControls";

interface ClipRow {
  id: string;
  label: string;
  audio_url: string;
  plays: number;
  author_id: string;
  created_at: string | null;
}

const MAX_SECONDS = 15;

export default function AirwavesSoundboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const recorder = useAudioRecorder(MAX_SECONDS);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const { data: clips, isLoading } = useQuery({
    queryKey: ["soundboard"],
    queryFn: async (): Promise<ClipRow[]> => {
      const { data, error } = await supabase
        .from("soundboard_clips")
        .select("id, label, audio_url, plays, author_id, created_at")
        .order("plays", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClipRow[];
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("soundboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "soundboard_clips" }, () =>
        queryClient.invalidateQueries({ queryKey: ["soundboard"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Clean up any playing audio on unmount.
  useEffect(() => () => audioRef.current?.pause(), []);

  const play = (clip: ClipRow) => {
    audioRef.current?.pause();
    const a = new Audio(clip.audio_url);
    audioRef.current = a;
    setPlayingId(clip.id);
    a.onended = () => setPlayingId((id) => (id === clip.id ? null : id));
    void a.play().catch(() => setPlayingId(null));
    void supabase
      .rpc("increment_soundboard_play", { clip: clip.id })
      .then(() => queryClient.invalidateQueries({ queryKey: ["soundboard"] }));
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const name = label.trim();
      if (!name) throw new Error("Give your clip a label");
      const source: Blob | null = file ?? recorder.blob;
      if (!source) throw new Error("Record or upload a sound first");
      const ext = file ? file.name.split(".").pop() || "mp3" : "webm";
      const url = await uploadToBucket("airwaves", `${user.id}/sound/${Date.now()}.${ext}`, source, source.type);
      const { error } = await supabase.from("soundboard_clips").insert({ author_id: user.id, label: name, audio_url: url });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clip added.");
      setLabel("");
      setFile(null);
      recorder.reset();
      if (fileRef.current) fileRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["soundboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add clip"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("soundboard_clips").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["soundboard"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  const canAdd = !!label.trim() && (!!file || !!recorder.blob) && !add.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <AudioLines className="w-6 h-6 text-primary" strokeWidth={1.5} /> Soundboard
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          The team's stingers, catchphrases and in-jokes. Tap to play. Add your own.
        </p>
      </div>

      {/* Add a clip */}
      <Card className="p-4 bg-card/60 border-border/30 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Add a clip</h3>
          <span className="text-xs text-muted-foreground">up to {MAX_SECONDS}s</span>
        </div>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. “Ship it!”" maxLength={40} className="bg-background/50" />
        <div className="flex flex-wrap items-center gap-2">
          <RecorderControls recorder={recorder} maxSeconds={MAX_SECONDS} label="Record" />
          <span className="text-xs text-muted-foreground">or</span>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); recorder.reset(); }}
          />
          <Button type="button" variant="outline" className="rounded-xl gap-2" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4" /> {file ? file.name.slice(0, 20) : "Upload audio"}
          </Button>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => add.mutate()} disabled={!canAdd} className="rounded-xl">
            {add.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
            Add to board
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading clips…
        </div>
      ) : clips && clips.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {clips.map((c) => {
            const active = playingId === c.id;
            return (
              <div key={c.id} className="relative group">
                <button
                  onClick={() => play(c)}
                  className={`w-full aspect-[5/3] rounded-2xl border flex flex-col items-center justify-center gap-1.5 px-3 text-center transition-all ${
                    active
                      ? "bg-primary/20 border-primary/50 scale-[0.98]"
                      : "bg-card/80 border-border/30 hover:bg-card hover:-translate-y-0.5"
                  }`}
                >
                  <Volume2 className={`w-5 h-5 ${active ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium text-foreground line-clamp-2 leading-tight">{c.label}</span>
                  <span className="text-[10px] text-muted-foreground">{c.plays} play{c.plays === 1 ? "" : "s"}</span>
                </button>
                {c.author_id === user?.id && (
                  <button
                    onClick={() => remove.mutate(c.id)}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="p-10 bg-card/40 border-border/20 text-center">
          <AudioLines className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No sounds yet. Add the first catchphrase.</p>
        </Card>
      )}
    </div>
  );
}
