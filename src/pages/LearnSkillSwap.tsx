import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  SKILL_FIELDS,
  initials,
  counterPrompt,
  type ProposalRow,
  type SwapAuthor,
  type SwapRow,
  type SwapType,
} from "@/lib/skills";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightLeft,
  Tag,
  User,
  Plus,
  Loader2,
  Check,
  X,
  Trash2,
  Inbox,
  Send,
  Megaphone,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const POST_SELECT =
  "*, author:profiles!skill_swaps_author_id_fkey(id,name,role,avatar_url), ping:profiles!skill_swaps_ping_user_id_fkey(id,name,role,avatar_url)";

export default function LearnSkillSwap() {
  const { user } = useAuth();
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const { data: swaps, isLoading } = useQuery({
    queryKey: ["skill-swaps"],
    queryFn: async () => {
      const { data } = await supabase
        .from("skill_swaps")
        .select(POST_SELECT)
        .neq("status", "closed")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as SwapRow[];
    },
    staleTime: 30_000,
  });

  const { data: proposals } = useQuery({
    queryKey: ["swap-proposals", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("skill_swap_proposals")
        .select(
          "*, post:skill_swaps(id,skill,type), proposer:profiles!skill_swap_proposals_proposer_id_fkey(id,name,role,avatar_url), post_author:profiles!skill_swap_proposals_post_author_id_fkey(id,name,role,avatar_url)",
        )
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as ProposalRow[];
    },
    enabled: !!user,
    staleTime: 20_000,
  });

  const filtered = useMemo(() => {
    const list = swaps ?? [];
    if (!activeTag) return list;
    return list.filter((s) => s.tags?.includes(activeTag));
  }, [swaps, activeTag]);

  const offerings = filtered.filter((s) => s.type === "offering");
  const seekings = filtered.filter((s) => s.type === "seeking");

  // Posts I've already proposed on, so we hide the CTA.
  const proposedPostIds = new Set(
    (proposals ?? []).filter((p) => p.proposer_id === user?.id).map((p) => p.post_id),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Skill Swap Board</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Offer what you know, find what you want to learn, and set up a swap.
          </p>
        </div>
        <PostDialog />
      </div>

      {/* Your swaps */}
      <YourSwaps proposals={proposals ?? []} />

      {/* Tag filters */}
      <div className="flex flex-wrap gap-2">
        <Badge
          onClick={() => setActiveTag(null)}
          variant={activeTag === null ? "default" : "outline"}
          className="cursor-pointer rounded-full px-4 py-1.5 text-xs font-medium transition-all hover:scale-105"
        >
          All
        </Badge>
        {SKILL_FIELDS.map((f) => (
          <Badge
            key={f}
            onClick={() => setActiveTag(f === activeTag ? null : f)}
            variant={f === activeTag ? "default" : "outline"}
            className="cursor-pointer rounded-full px-4 py-1.5 text-xs font-medium transition-all hover:scale-105"
          >
            {f}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SwapColumn
          title="Offering"
          dotClass="bg-emerald-400"
          accent="emerald"
          posts={offerings}
          isLoading={isLoading}
          emptyIcon={<User className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />}
          emptyText="No skills offered yet."
          proposedPostIds={proposedPostIds}
        />
        <SwapColumn
          title="Seeking"
          dotClass="bg-blue-400"
          accent="blue"
          posts={seekings}
          isLoading={isLoading}
          emptyIcon={<ArrowRightLeft className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />}
          emptyText="No one is seeking skills right now."
          proposedPostIds={proposedPostIds}
        />
      </div>
    </div>
  );
}

// ── Board column ────────────────────────────────────────────
function SwapColumn({
  title,
  dotClass,
  accent,
  posts,
  isLoading,
  emptyIcon,
  emptyText,
  proposedPostIds,
}: {
  title: string;
  dotClass: string;
  accent: "emerald" | "blue";
  posts: SwapRow[];
  isLoading: boolean;
  emptyIcon: React.ReactNode;
  emptyText: string;
  proposedPostIds: Set<string>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className={cn("w-3 h-3 rounded-full", dotClass)} />
        <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
        <Badge variant="secondary" className="text-[10px]">{posts.length}</Badge>
      </div>
      <div className="space-y-3">
        {isLoading ? (
          [1, 2].map((i) => (
            <Card key={i} className="p-4 bg-card/60 border-border/30 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted/20" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 bg-muted/20 rounded" />
                  <div className="h-2 w-3/4 bg-muted/10 rounded" />
                </div>
              </div>
            </Card>
          ))
        ) : posts.length > 0 ? (
          posts.map((swap) => (
            <SwapCard key={swap.id} swap={swap} accent={accent} alreadyProposed={proposedPostIds.has(swap.id)} />
          ))
        ) : (
          <Card className="p-8 bg-card/60 border-border/30 text-center">
            {emptyIcon}
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Single post card ────────────────────────────────────────
function SwapCard({ swap, accent, alreadyProposed }: { swap: SwapRow; accent: "emerald" | "blue"; alreadyProposed: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mine = swap.author_id === user?.id;

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("skill_swaps").delete().eq("id", swap.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-swaps"] });
      toast.success("Post removed.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't remove."),
  });

  const close = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("skill_swaps").update({ status: "closed" }).eq("id", swap.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-swaps"] });
      toast.success("Post closed — it's off the board.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't close."),
  });

  const avatarClass = accent === "emerald" ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400";

  return (
    <Card className="p-4 bg-card/60 border-border/30 shadow-lg shadow-black/10 hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start gap-3">
        <Avatar className="w-9 h-9 ring-2 ring-border/30 flex-shrink-0">
          <AvatarImage src={swap.author?.avatar_url ?? undefined} />
          <AvatarFallback className={cn("text-xs", avatarClass)}>{initials(swap.author?.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">{swap.author?.name}</span>
            <span className="text-[10px] text-muted-foreground">{swap.author?.role}</span>
            {swap.status === "matched" && (
              <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-300">matched</Badge>
            )}
          </div>
          <p className="text-sm font-medium text-foreground mt-0.5">{swap.skill}</p>
          {swap.blurb && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{swap.blurb}</p>}

          {swap.counter_skill && (
            <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
              <ArrowRightLeft className="w-3 h-3" />
              {swap.type === "offering" ? "Wants in return:" : "Can offer:"}{" "}
              <span className="text-foreground/80 font-medium">{swap.counter_skill}</span>
            </p>
          )}

          {!!swap.tags?.length && (
            <div className="flex flex-wrap gap-1 mt-2">
              {swap.tags.map((tag) => (
                <span key={tag} className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {swap.ping && (
            <p className="text-[11px] text-primary/80 mt-1.5 flex items-center gap-1">
              <Megaphone className="w-3 h-3" /> for {swap.ping.name}
            </p>
          )}

          <div className="mt-3">
            {mine ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => close.mutate()}
                  disabled={close.isPending}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <CheckCircle2 className="w-3 h-3" /> {swap.status === "matched" ? "Mark done" : "Close"}
                </button>
                <button
                  onClick={() => remove.mutate()}
                  disabled={remove.isPending}
                  className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            ) : alreadyProposed ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Check className="w-3 h-3" /> Swap requested
              </span>
            ) : (
              <ProposeDialog post={swap} />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Post a skill ────────────────────────────────────────────
function PostDialog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SwapType>("offering");
  const [skill, setSkill] = useState("");
  const [blurb, setBlurb] = useState("");
  const [counter, setCounter] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [pingId, setPingId] = useState<string>("none");

  const { data: people } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,name,role,avatar_url").order("name");
      return (data ?? []) as SwapAuthor[];
    },
    enabled: open,
    staleTime: 300_000,
  });

  const reset = () => {
    setType("offering");
    setSkill("");
    setBlurb("");
    setCounter("");
    setTags([]);
    setPingId("none");
  };

  const toggleTag = (t: string) => setTags((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const post = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in.");
      const s = skill.trim();
      if (!s) throw new Error("What's the skill?");
      const { error } = await supabase.from("skill_swaps").insert({
        type,
        skill: s,
        blurb: blurb.trim() || null,
        counter_skill: counter.trim() || null,
        tags,
        ping_user_id: pingId === "none" ? null : pingId,
        author_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-swaps"] });
      toast.success("Posted to the board.");
      reset();
      setOpen(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't post."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> Post a skill
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/40 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Post a skill</DialogTitle>
          <DialogDescription>Offer something you can teach, or ask to learn something.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            {(["offering", "seeking"] as SwapType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-colors",
                  type === t ? "bg-primary/15 text-primary" : "bg-muted/20 text-muted-foreground hover:bg-muted/30",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>{type === "offering" ? "Skill you're offering" : "Skill you want to learn"}</Label>
            <Input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. Figma prototyping" />
          </div>

          <div className="space-y-1.5">
            <Label>Brief description</Label>
            <Textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={2} placeholder="A line on what you'll cover or want." />
          </div>

          <div className="space-y-1.5">
            <Label>Fields</Label>
            <div className="flex flex-wrap gap-2">
              {SKILL_FIELDS.map((f) => (
                <Badge
                  key={f}
                  onClick={() => toggleTag(f)}
                  variant={tags.includes(f) ? "default" : "outline"}
                  className="cursor-pointer rounded-full px-3 py-1 text-xs transition-all hover:scale-105"
                >
                  {tags.includes(f) && <Check className="w-3 h-3 mr-1" />}
                  {f}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{type === "offering" ? "Skill you'd like in return (optional)" : "Skill you can offer in return (optional)"}</Label>
            <Input value={counter} onChange={(e) => setCounter(e.target.value)} placeholder="Leave blank to let the other person decide" />
          </div>

          <div className="space-y-1.5">
            <Label>Ping someone in particular (optional)</Label>
            <Select value={pingId} onValueChange={setPingId}>
              <SelectTrigger>
                <SelectValue placeholder="Anyone on the team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Anyone on the team</SelectItem>
                {(people ?? []).filter((p) => p.id !== user?.id).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button disabled={post.isPending} onClick={() => post.mutate()}>
            {post.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Set up a swap (propose) ─────────────────────────────────
function ProposeDialog({ post }: { post: SwapRow }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [theirSkill, setTheirSkill] = useState(post.counter_skill ?? "");
  const [theirBlurb, setTheirBlurb] = useState("");
  const [message, setMessage] = useState("");

  const prompt = counterPrompt(post);

  const propose = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in.");
      const { error } = await supabase.from("skill_swap_proposals").insert({
        post_id: post.id,
        post_author_id: post.author_id,
        proposer_id: user.id,
        their_skill: theirSkill.trim() || null,
        their_blurb: theirBlurb.trim() || null,
        message: message.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swap-proposals", user?.id] });
      toast.success(`Swap request sent to ${post.author?.name ?? "them"}.`);
      setOpen(false);
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error && e.message.includes("duplicate")
          ? "You've already requested this swap."
          : e instanceof Error
            ? e.message
            : "Couldn't send the request.",
      ),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-lg text-xs">
          <ArrowRightLeft className="w-3 h-3 mr-1.5" /> Set up a swap
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/40 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Set up a swap</DialogTitle>
          <DialogDescription>
            {post.author?.name} {post.type === "offering" ? "offers" : "wants to learn"}{" "}
            <span className="text-foreground font-medium">{post.skill}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{prompt.label}</Label>
            <Input
              value={theirSkill}
              onChange={(e) => setTheirSkill(e.target.value)}
              placeholder={prompt.prefilled ? prompt.prefilled : "e.g. Copywriting"}
            />
            {prompt.prefilled && (
              <p className="text-[11px] text-muted-foreground">They suggested: {prompt.prefilled}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>A little detail (optional)</Label>
            <Textarea value={theirBlurb} onChange={(e) => setTheirBlurb(e.target.value)} rows={2} placeholder="What you'd bring to the swap." />
          </div>
          <div className="space-y-1.5">
            <Label>Message (optional)</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Say hi, suggest a time…" />
          </div>
        </div>

        <DialogFooter>
          <Button disabled={propose.isPending} onClick={() => propose.mutate()}>
            {propose.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Your swaps (incoming + outgoing) ────────────────────────
function YourSwaps({ proposals }: { proposals: ProposalRow[] }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const incoming = proposals.filter((p) => p.post_author_id === user?.id && p.status === "pending");
  const outgoing = proposals.filter((p) => p.proposer_id === user?.id);

  const respond = useMutation({
    mutationFn: async ({ id, status, postId }: { id: string; status: "accepted" | "declined"; postId: string }) => {
      const { error } = await supabase.from("skill_swap_proposals").update({ status }).eq("id", id);
      if (error) throw error;
      if (status === "accepted") {
        await supabase.from("skill_swaps").update({ status: "matched" }).eq("id", postId);
      }
    },
    onSuccess: (_d, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["swap-proposals", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["skill-swaps"] });
      toast.success(status === "accepted" ? "Swap on! Reach out to set a time." : "Declined.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't update."),
  });

  const withdraw = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("skill_swap_proposals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swap-proposals", user?.id] });
      toast.success("Request withdrawn.");
    },
  });

  if (incoming.length === 0 && outgoing.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Incoming */}
      <Card className="p-4 bg-card/60 border-border/30">
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Swap requests for you</h3>
          {incoming.length > 0 && <Badge variant="secondary" className="text-[10px]">{incoming.length}</Badge>}
        </div>
        {incoming.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing pending.</p>
        ) : (
          <div className="space-y-3">
            {incoming.map((p) => (
              <div key={p.id} className="flex items-start gap-3 border-b border-border/20 pb-3 last:border-0 last:pb-0">
                <Avatar className="w-8 h-8 ring-1 ring-border/30 flex-shrink-0">
                  <AvatarImage src={p.proposer?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">{initials(p.proposer?.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{p.proposer?.name}</span> on{" "}
                    <span className="font-medium">{p.post?.skill}</span>
                  </p>
                  {p.their_skill && <p className="text-xs text-muted-foreground">Offers: {p.their_skill}</p>}
                  {p.message && <p className="text-xs text-muted-foreground italic mt-0.5">"{p.message}"</p>}
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" className="h-7 text-xs" disabled={respond.isPending}
                      onClick={() => respond.mutate({ id: p.id, status: "accepted", postId: p.post_id })}>
                      <Check className="w-3 h-3 mr-1" /> Accept
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={respond.isPending}
                      onClick={() => respond.mutate({ id: p.id, status: "declined", postId: p.post_id })}>
                      <X className="w-3 h-3 mr-1" /> Decline
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Outgoing */}
      <Card className="p-4 bg-card/60 border-border/30">
        <div className="flex items-center gap-2 mb-3">
          <Send className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Your requests</h3>
        </div>
        {outgoing.length === 0 ? (
          <p className="text-xs text-muted-foreground">You haven't requested any swaps yet.</p>
        ) : (
          <div className="space-y-3">
            {outgoing.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b border-border/20 pb-3 last:border-0 last:pb-0">
                <Avatar className="w-8 h-8 ring-1 ring-border/30 flex-shrink-0">
                  <AvatarImage src={p.post_author?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-muted/40 text-foreground/70 text-[10px]">{initials(p.post_author?.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{p.post?.skill}</span> with {p.post_author?.name}
                  </p>
                  <p className={cn(
                    "text-xs",
                    p.status === "accepted" ? "text-emerald-400" : p.status === "declined" ? "text-muted-foreground" : "text-amber-400",
                  )}>
                    {p.status === "accepted" ? "Accepted — reach out!" : p.status === "declined" ? "Declined" : "Pending"}
                  </p>
                </div>
                {p.status === "pending" && (
                  <button onClick={() => withdraw.mutate(p.id)} className="text-muted-foreground hover:text-destructive" title="Withdraw">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
