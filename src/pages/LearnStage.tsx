import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadToBucket } from "@/lib/storage";
import { initials } from "@/hooks/useTeam";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Sparkles, Plus, Loader2, Upload, CalendarPlus, CalendarClock, Trash2, Presentation } from "lucide-react";
import StagePostCard, { type StagePostRow, type StageReactionRow } from "@/components/stage/StagePostCard";
import DateTimePicker from "@/components/DateTimePicker";

interface DemoSlotRow {
  id: string;
  host_id: string;
  title: string;
  scheduled_at: string;
  notes: string | null;
  host: { name: string | null; avatar_url: string | null } | null;
}

function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function LearnStage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Post composer ──
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // ── Demo slot composer ──
  const [slotTitle, setSlotTitle] = useState("");
  const [slotWhen, setSlotWhen] = useState<Date | null>(null);
  const [slotNotes, setSlotNotes] = useState("");

  const { data: posts, isLoading } = useQuery({
    queryKey: ["stage-posts"],
    queryFn: async (): Promise<StagePostRow[]> => {
      const { data, error } = await supabase
        .from("stage_posts")
        .select(
          "id, title, description, link_url, image_url, author_id, created_at, author:profiles!stage_posts_author_id_fkey(name, avatar_url)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as StagePostRow[];
    },
    staleTime: 15_000,
  });

  const postIds = (posts ?? []).map((p) => p.id);
  const { data: reactions } = useQuery({
    queryKey: ["stage-reactions"],
    enabled: postIds.length > 0,
    queryFn: async (): Promise<StageReactionRow[]> => {
      const { data, error } = await supabase
        .from("stage_reactions")
        .select("id, post_id, user_id, emoji")
        .in("post_id", postIds);
      if (error) throw error;
      return (data ?? []) as StageReactionRow[];
    },
    staleTime: 15_000,
  });

  const reactionsByPost = (reactions ?? []).reduce<Record<string, StageReactionRow[]>>((acc, r) => {
    (acc[r.post_id] ??= []).push(r);
    return acc;
  }, {});

  const { data: slots } = useQuery({
    queryKey: ["stage-demo-slots"],
    queryFn: async (): Promise<DemoSlotRow[]> => {
      const { data, error } = await supabase
        .from("stage_demo_slots")
        .select("id, host_id, title, scheduled_at, notes, host:profiles!stage_demo_slots_host_id_fkey(name, avatar_url)")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DemoSlotRow[];
    },
    staleTime: 30_000,
  });

  // Realtime.
  useEffect(() => {
    const channel = supabase
      .channel("stage")
      .on("postgres_changes", { event: "*", schema: "public", table: "stage_posts" }, () =>
        queryClient.invalidateQueries({ queryKey: ["stage-posts"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "stage_reactions" }, () =>
        queryClient.invalidateQueries({ queryKey: ["stage-reactions"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "stage_comments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["stage-comments"] });
        queryClient.invalidateQueries({ queryKey: ["stage-comment-count"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "stage_demo_slots" }, () =>
        queryClient.invalidateQueries({ queryKey: ["stage-demo-slots"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const resetComposer = () => {
    setTitle("");
    setDescription("");
    setLinkUrl("");
    setImageUrl("");
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const createPost = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const t = title.trim();
      if (!t) throw new Error("Give your post a title");
      let img = imageUrl.trim() || null;
      if (file) img = await uploadToBucket("stage", `${user.id}/${Date.now()}-${file.name}`, file);
      const { error } = await supabase.from("stage_posts").insert({
        author_id: user.id,
        title: t,
        description: description.trim() || null,
        link_url: linkUrl.trim() || null,
        image_url: img,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Posted to The Stage!");
      resetComposer();
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["stage-posts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not post"),
  });

  const claimSlot = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const t = slotTitle.trim();
      if (!t) throw new Error("What will you demo?");
      if (!slotWhen) throw new Error("Pick a date and time");
      const { error } = await supabase.from("stage_demo_slots").insert({
        host_id: user.id,
        title: t,
        scheduled_at: slotWhen.toISOString(),
        notes: slotNotes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demo slot claimed.");
      setSlotTitle("");
      setSlotWhen(null);
      setSlotNotes("");
      queryClient.invalidateQueries({ queryKey: ["stage-demo-slots"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not claim slot"),
  });

  const deleteSlot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stage_demo_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stage-demo-slots"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove slot"),
  });

  const onPickFile = (f: File | null) => {
    setFile(f);
    if (f) {
      setImageUrl("");
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Presentation className="w-6 h-6 text-teal-400" strokeWidth={1.5} /> The Stage
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Show the team what you built or shipped — and book a slot to demo it live.
        </p>
      </div>

      <Tabs defaultValue="showcase">
        <TabsList className="bg-card/60 border border-border/30">
          <TabsTrigger value="showcase">Showcase</TabsTrigger>
          <TabsTrigger value="demos">Demo Day</TabsTrigger>
        </TabsList>

        {/* ── Showcase feed ── */}
        <TabsContent value="showcase" className="mt-5 space-y-5">
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetComposer(); }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl">
                <Plus className="w-4 h-4 mr-1.5" /> Share something
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border/30">
              <DialogHeader>
                <DialogTitle className="font-display">Share something you made</DialogTitle>
                <DialogDescription>A build, an experiment, a shipped feature — anything you're proud of.</DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. A CLI that drafts release notes" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What is it, and what's interesting about it?" />
                </div>
                <div className="space-y-1.5">
                  <Label>Link (optional)</Label>
                  <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://… repo, demo, doc" />
                </div>

                {(preview || imageUrl.trim()) && (
                  <div className="rounded-xl overflow-hidden border border-border/30 bg-muted/20">
                    <img src={preview ?? imageUrl.trim()} alt="preview" className="w-full h-auto max-h-56 object-contain" />
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => fileRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1.5" /> {file ? "Change image" : "Upload image"}
                  </Button>
                  <Input
                    value={imageUrl}
                    onChange={(e) => { setImageUrl(e.target.value); if (e.target.value) onPickFile(null); }}
                    placeholder="or image URL"
                    disabled={!!file}
                    className="flex-1"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => createPost.mutate()} disabled={createPost.isPending || !title.trim()} className="rounded-xl">
                  {createPost.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                  Post it
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading the stage…
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
              {posts.map((p) => (
                <StagePostCard key={p.id} post={p} reactions={reactionsByPost[p.id] ?? []} />
              ))}
            </div>
          ) : (
            <Card className="p-10 bg-card/40 border-border/20 text-center">
              <Presentation className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nothing on the stage yet — be the first to show your work.</p>
            </Card>
          )}
        </TabsContent>

        {/* ── Demo Day ── */}
        <TabsContent value="demos" className="mt-5 space-y-5 max-w-3xl">
          <Card className="p-4 bg-card/60 border-border/30 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <CalendarPlus className="w-4 h-4 text-teal-400" />
              <h3 className="font-display font-semibold text-foreground">Claim a demo slot</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input value={slotTitle} onChange={(e) => setSlotTitle(e.target.value)} placeholder="What you'll demo" />
              <DateTimePicker value={slotWhen} onChange={setSlotWhen} placeholder="When?" />
            </div>
            <Input value={slotNotes} onChange={(e) => setSlotNotes(e.target.value)} placeholder="Notes (optional) — link, prerequisites…" />
            <div className="flex justify-end">
              <Button onClick={() => claimSlot.mutate()} disabled={claimSlot.isPending || !slotTitle.trim() || !slotWhen} className="rounded-xl">
                {claimSlot.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CalendarPlus className="w-4 h-4 mr-1.5" />}
                Claim slot
              </Button>
            </div>
          </Card>

          {slots && slots.length > 0 ? (
            <div className="space-y-3">
              {slots.map((s) => (
                <Card key={s.id} className="p-4 bg-card/60 border-border/30 rounded-2xl flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-teal-500/10 flex flex-col items-center justify-center shrink-0">
                    <CalendarClock className="w-5 h-5 text-teal-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{formatSlot(s.scheduled_at)}</p>
                    {s.notes && <p className="text-xs text-muted-foreground/80 mt-0.5 truncate">{s.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Avatar className="w-7 h-7 ring-1 ring-border/30">
                      <AvatarImage src={s.host?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary text-[9px]">{initials(s.host?.name)}</AvatarFallback>
                    </Avatar>
                    {s.host_id === user?.id && (
                      <button onClick={() => deleteSlot.mutate(s.id)} className="text-muted-foreground hover:text-destructive transition-colors" title="Cancel slot">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-10 bg-card/40 border-border/20 text-center">
              <CalendarClock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No demos scheduled. Claim the first slot above.</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
