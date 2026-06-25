import { useEffect, useMemo, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Loader2, Upload, Podcast, Mic2, Headphones, Heart } from "lucide-react";
import RecorderControls from "@/components/airwaves/RecorderControls";
import PodEpisodeCard, { type PodEpisodeRow, type PodReactionRow } from "@/components/airwaves/PodEpisodeCard";

const MAX_SECONDS = 15 * 60;

interface ShowRow {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  created_at: string | null;
  owner: { name: string | null; avatar_url: string | null } | null;
}

function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      const d = a.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? Math.round(d) : null);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    a.src = url;
  });
}

export default function AirwavesPod() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "following">("all");

  // Create-show dialog
  const [showOpen, setShowOpen] = useState(false);
  const [showTitle, setShowTitle] = useState("");
  const [showDesc, setShowDesc] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // Create-episode dialog
  const [epOpen, setEpOpen] = useState(false);
  const [epShowId, setEpShowId] = useState<string>("");
  const [epTitle, setEpTitle] = useState("");
  const [epDesc, setEpDesc] = useState("");
  const [epFile, setEpFile] = useState<File | null>(null);
  const epFileRef = useRef<HTMLInputElement>(null);
  const recorder = useAudioRecorder(MAX_SECONDS);

  const { data: shows } = useQuery({
    queryKey: ["pod-shows"],
    queryFn: async (): Promise<ShowRow[]> => {
      const { data, error } = await supabase
        .from("pod_shows")
        .select("id, owner_id, title, description, cover_url, created_at, owner:profiles!pod_shows_owner_id_fkey(name, avatar_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ShowRow[];
    },
    staleTime: 30_000,
  });

  const { data: follows } = useQuery({
    queryKey: ["pod-follows"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pod_follows").select("show_id, user_id");
      if (error) throw error;
      return (data ?? []) as { show_id: string; user_id: string }[];
    },
    staleTime: 30_000,
  });

  const { data: epCounts } = useQuery({
    queryKey: ["pod-episode-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pod_episodes").select("show_id");
      if (error) throw error;
      return (data ?? []) as { show_id: string }[];
    },
    staleTime: 30_000,
  });

  // Episodes for the open show
  const { data: episodes } = useQuery({
    queryKey: ["pod-episodes", selectedShowId],
    enabled: !!selectedShowId,
    queryFn: async (): Promise<PodEpisodeRow[]> => {
      const { data, error } = await supabase
        .from("pod_episodes")
        .select("id, show_id, title, description, audio_url, duration_seconds, author_id, created_at, author:profiles!pod_episodes_author_id_fkey(name, avatar_url)")
        .eq("show_id", selectedShowId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PodEpisodeRow[];
    },
    staleTime: 15_000,
  });

  const episodeIds = (episodes ?? []).map((e) => e.id);
  const { data: reactions } = useQuery({
    queryKey: ["pod-episode-reactions", selectedShowId],
    enabled: episodeIds.length > 0,
    queryFn: async (): Promise<PodReactionRow[]> => {
      const { data, error } = await supabase.from("pod_episode_reactions").select("id, episode_id, user_id, emoji").in("episode_id", episodeIds);
      if (error) throw error;
      return (data ?? []) as PodReactionRow[];
    },
    staleTime: 15_000,
  });

  const { data: progress } = useQuery({
    queryKey: ["pod-progress", selectedShowId],
    enabled: !!user && episodeIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pod_progress")
        .select("episode_id, position_seconds")
        .eq("user_id", user!.id)
        .in("episode_id", episodeIds);
      if (error) throw error;
      return (data ?? []) as { episode_id: string; position_seconds: number }[];
    },
    staleTime: 15_000,
  });

  const reactionsByEpisode = (reactions ?? []).reduce<Record<string, PodReactionRow[]>>((acc, r) => {
    (acc[r.episode_id] ??= []).push(r);
    return acc;
  }, {});
  const progressByEpisode = (progress ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.episode_id] = p.position_seconds;
    return acc;
  }, {});
  const countByShow = (epCounts ?? []).reduce<Record<string, number>>((acc, e) => {
    acc[e.show_id] = (acc[e.show_id] ?? 0) + 1;
    return acc;
  }, {});
  const followersByShow = (follows ?? []).reduce<Record<string, number>>((acc, f) => {
    acc[f.show_id] = (acc[f.show_id] ?? 0) + 1;
    return acc;
  }, {});
  const iFollow = useMemo(
    () => new Set((follows ?? []).filter((f) => f.user_id === user?.id).map((f) => f.show_id)),
    [follows, user?.id]
  );

  const myShows = (shows ?? []).filter((s) => s.owner_id === user?.id);
  const visibleShows = (shows ?? []).filter((s) => filter === "all" || iFollow.has(s.id));
  const selectedShow = (shows ?? []).find((s) => s.id === selectedShowId) ?? null;

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("the-pod")
      .on("postgres_changes", { event: "*", schema: "public", table: "pod_shows" }, () =>
        queryClient.invalidateQueries({ queryKey: ["pod-shows"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "pod_episodes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["pod-episodes"] });
        queryClient.invalidateQueries({ queryKey: ["pod-episode-counts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pod_episode_reactions" }, () =>
        queryClient.invalidateQueries({ queryKey: ["pod-episode-reactions"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "pod_episode_comments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["pod-episode-comments"] });
        queryClient.invalidateQueries({ queryKey: ["pod-episode-comment-count"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pod_follows" }, () =>
        queryClient.invalidateQueries({ queryKey: ["pod-follows"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createShow = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const t = showTitle.trim();
      if (!t) throw new Error("Give your show a name");
      let cover: string | null = null;
      if (coverFile) cover = await uploadToBucket("airwaves", `${user.id}/pod-covers/${Date.now()}-${coverFile.name}`, coverFile, coverFile.type);
      const { error } = await supabase.from("pod_shows").insert({ owner_id: user.id, title: t, description: showDesc.trim() || null, cover_url: cover });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Show created.");
      setShowTitle("");
      setShowDesc("");
      setCoverFile(null);
      if (coverRef.current) coverRef.current.value = "";
      setShowOpen(false);
      queryClient.invalidateQueries({ queryKey: ["pod-shows"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create show"),
  });

  const createEpisode = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!epShowId) throw new Error("Pick which show this belongs to");
      const t = epTitle.trim();
      if (!t) throw new Error("Give the episode a title");
      const source: Blob | null = epFile ?? recorder.blob;
      if (!source) throw new Error("Record or upload the audio first");

      let duration: number | null = recorder.blob ? recorder.seconds : null;
      if (epFile) {
        duration = await readAudioDuration(epFile);
        if (duration && duration > MAX_SECONDS) throw new Error("Episode is over 15 minutes — trim it first.");
      }
      const ext = epFile ? epFile.name.split(".").pop() || "mp3" : "webm";
      const url = await uploadToBucket("airwaves", `${user.id}/pod/${Date.now()}.${ext}`, source, source.type);
      const { error } = await supabase.from("pod_episodes").insert({
        show_id: epShowId,
        author_id: user.id,
        title: t,
        description: epDesc.trim() || null,
        audio_url: url,
        duration_seconds: duration,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Episode published.");
      setEpTitle("");
      setEpDesc("");
      setEpFile(null);
      recorder.reset();
      if (epFileRef.current) epFileRef.current.value = "";
      setEpOpen(false);
      queryClient.invalidateQueries({ queryKey: ["pod-episodes"] });
      queryClient.invalidateQueries({ queryKey: ["pod-episode-counts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not publish episode"),
  });

  const toggleFollow = useMutation({
    mutationFn: async (showId: string) => {
      if (!user) throw new Error("Not signed in");
      if (iFollow.has(showId)) {
        const { error } = await supabase.from("pod_follows").delete().eq("show_id", showId).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pod_follows").insert({ show_id: showId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pod-follows"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update follow"),
  });

  const saveProgress = (episodeId: string, seconds: number) => {
    if (!user) return;
    void supabase
      .from("pod_progress")
      .upsert(
        { user_id: user.id, episode_id: episodeId, position_seconds: Math.round(seconds), updated_at: new Date().toISOString() },
        { onConflict: "user_id,episode_id" }
      );
  };

  const openEpisodeDialog = (showId?: string) => {
    setEpShowId(showId ?? (myShows[0]?.id ?? ""));
    setEpOpen(true);
  };

  // ── Create-episode dialog (shared by list + detail) ──
  const episodeDialog = (
    <Dialog open={epOpen} onOpenChange={(o) => { setEpOpen(o); if (!o) { recorder.reset(); setEpFile(null); } }}>
      <DialogContent className="bg-card border-border/30">
        <DialogHeader>
          <DialogTitle className="font-display">New episode</DialogTitle>
          <DialogDescription>Record up to 15 minutes, or upload a finished audio file.</DialogDescription>
        </DialogHeader>
        {myShows.length === 0 ? (
          <p className="text-sm text-muted-foreground">You need a show first — create one, then publish episodes to it.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Show</Label>
              <Select value={epShowId} onValueChange={setEpShowId}>
                <SelectTrigger><SelectValue placeholder="Pick a show" /></SelectTrigger>
                <SelectContent>
                  {myShows.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={epTitle} onChange={(e) => setEpTitle(e.target.value)} placeholder="Episode title" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea value={epDesc} onChange={(e) => setEpDesc(e.target.value)} rows={2} placeholder="Show notes, links, chapters…" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RecorderControls recorder={recorder} maxSeconds={MAX_SECONDS} label="Record" />
              <span className="text-xs text-muted-foreground">or</span>
              <input ref={epFileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { setEpFile(e.target.files?.[0] ?? null); recorder.reset(); }} />
              <Button type="button" variant="outline" className="rounded-xl gap-2" onClick={() => epFileRef.current?.click()}>
                <Upload className="w-4 h-4" /> {epFile ? epFile.name.slice(0, 18) : "Upload audio"}
              </Button>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            onClick={() => createEpisode.mutate()}
            disabled={createEpisode.isPending || myShows.length === 0 || !epTitle.trim() || (!epFile && !recorder.blob)}
            className="rounded-xl"
          >
            {createEpisode.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Mic2 className="w-4 h-4 mr-1.5" />}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Show detail view ──
  if (selectedShow) {
    const owned = selectedShow.owner_id === user?.id;
    return (
      <div className="space-y-6 animate-fade-in">
        <button onClick={() => setSelectedShowId(null)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> All shows
        </button>

        <Card className="p-5 bg-card/60 border-border/30 rounded-2xl flex items-start gap-4">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-rose-500/20 to-red-500/10 flex items-center justify-center shrink-0">
            {selectedShow.cover_url ? <img src={selectedShow.cover_url} alt={selectedShow.title} className="w-full h-full object-contain" /> : <Podcast className="w-8 h-8 text-rose-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-bold text-foreground truncate">{selectedShow.title}</h2>
            <p className="text-xs text-muted-foreground">{selectedShow.owner?.name ?? "Someone"} · {followersByShow[selectedShow.id] ?? 0} follower{(followersByShow[selectedShow.id] ?? 0) === 1 ? "" : "s"}</p>
            {selectedShow.description && <p className="text-sm text-muted-foreground mt-1.5">{selectedShow.description}</p>}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button size="sm" variant={iFollow.has(selectedShow.id) ? "secondary" : "outline"} className="rounded-xl gap-1.5" onClick={() => toggleFollow.mutate(selectedShow.id)}>
              <Heart className={`w-3.5 h-3.5 ${iFollow.has(selectedShow.id) ? "fill-current text-rose-400" : ""}`} />
              {iFollow.has(selectedShow.id) ? "Following" : "Follow"}
            </Button>
            {owned && (
              <Button size="sm" className="rounded-xl gap-1.5" onClick={() => openEpisodeDialog(selectedShow.id)}>
                <Plus className="w-3.5 h-3.5" /> Episode
              </Button>
            )}
          </div>
        </Card>

        {episodes && episodes.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {episodes.map((ep) => (
              <PodEpisodeCard
                key={ep.id}
                episode={ep}
                reactions={reactionsByEpisode[ep.id] ?? []}
                startAt={progressByEpisode[ep.id] ?? null}
                onSaveProgress={saveProgress}
              />
            ))}
          </div>
        ) : (
          <Card className="p-10 bg-card/40 border-border/20 text-center">
            <Headphones className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{owned ? "No episodes yet — publish your first." : "No episodes yet."}</p>
          </Card>
        )}
        {episodeDialog}
      </div>
    );
  }

  // ── Shows list view ──
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Podcast className="w-6 h-6 text-primary" strokeWidth={1.5} /> The Pod
          </h2>
          <p className="text-sm text-muted-foreground mt-1">The team's shows. Create one, publish episodes, follow the rest.</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showOpen} onOpenChange={(o) => { setShowOpen(o); if (!o) { setCoverFile(null); if (coverRef.current) coverRef.current.value = ""; } }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-xl"><Plus className="w-4 h-4 mr-1.5" /> New show</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border/30">
              <DialogHeader>
                <DialogTitle className="font-display">Create a show</DialogTitle>
                <DialogDescription>A home for your episodes — like "Design Diaries" or "Friday Rants".</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input value={showTitle} onChange={(e) => setShowTitle(e.target.value)} placeholder="Show name" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description (optional)</Label>
                  <Textarea value={showDesc} onChange={(e) => setShowDesc(e.target.value)} rows={2} placeholder="What's it about?" />
                </div>
                <div className="space-y-1.5">
                  <Label>Cover (optional)</Label>
                  <div className="flex items-center gap-3">
                    {coverFile && <img src={URL.createObjectURL(coverFile)} alt="cover" className="w-12 h-12 rounded-lg object-cover" />}
                    <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
                    <Button type="button" variant="outline" className="rounded-xl gap-2" onClick={() => coverRef.current?.click()}>
                      <Upload className="w-4 h-4" /> {coverFile ? "Change" : "Upload"}
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => createShow.mutate()} disabled={createShow.isPending || !showTitle.trim()} className="rounded-xl">
                  {createShow.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button className="rounded-xl" onClick={() => openEpisodeDialog()}><Mic2 className="w-4 h-4 mr-1.5" /> New episode</Button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "following"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
              filter === f ? "bg-primary/15 text-primary" : "bg-muted/15 text-muted-foreground hover:bg-muted/25"
            }`}
          >
            {f === "all" ? "All shows" : "Following"}
          </button>
        ))}
      </div>

      {visibleShows.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleShows.map((s) => (
            <Card
              key={s.id}
              onClick={() => setSelectedShowId(s.id)}
              className="overflow-hidden border-border/30 bg-card/60 cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 transition-all duration-300"
            >
              <div className="h-56 bg-gradient-to-br from-rose-500/20 to-red-500/10 flex items-center justify-center">
                {s.cover_url ? <img src={s.cover_url} alt={s.title} className="w-full h-full object-contain" /> : <Podcast className="w-10 h-10 text-rose-300/60" />}
              </div>
              <div className="p-4">
                <h3 className="font-display font-semibold text-foreground truncate">{s.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {s.owner?.name ?? "Someone"} · {countByShow[s.id] ?? 0} episode{(countByShow[s.id] ?? 0) === 1 ? "" : "s"} · {followersByShow[s.id] ?? 0} follower{(followersByShow[s.id] ?? 0) === 1 ? "" : "s"}
                </p>
                {s.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{s.description}</p>}
                <Button
                  size="sm"
                  variant={iFollow.has(s.id) ? "secondary" : "outline"}
                  className="mt-3 rounded-xl gap-1.5"
                  onClick={(e) => { e.stopPropagation(); toggleFollow.mutate(s.id); }}
                >
                  <Heart className={`w-3.5 h-3.5 ${iFollow.has(s.id) ? "fill-current text-rose-400" : ""}`} />
                  {iFollow.has(s.id) ? "Following" : "Follow"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-10 bg-card/40 border-border/20 text-center">
          <Podcast className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {filter === "following" ? "You're not following any shows yet." : "No shows yet — create the first one."}
          </p>
        </Card>
      )}

      {episodeDialog}
    </div>
  );
}
