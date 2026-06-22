import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  AMA_MODES,
  EXTEND_MINUTES,
  initials,
  modeLabel,
  remaining,
  formatWhen,
  type AmaMessageRow,
  type AmaMode,
  type AmaPerson,
  type AmaSession,
  type BankQuestion,
} from "@/lib/ama";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Plus,
  Loader2,
  ArrowLeft,
  Send,
  Clock,
  Play,
  Square,
  TimerReset,
  UserPlus,
  Check,
  Radio,
  CalendarClock,
  Sparkles,
  Shuffle,
  MessagesSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Stable per-seed shuffle so the prompt panel doesn't reshuffle on every
// render (the live timer re-renders each second); changing the seed reshuffles.
function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
function seededShuffle<T extends { id: string }>(arr: T[], seed: number): T[] {
  return [...arr].sort((a, b) => hashId(a.id + ":" + seed) - hashId(b.id + ":" + seed));
}

function useProfiles(enabled = true) {
  return useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,name,role,avatar_url").order("name");
      return (data ?? []) as AmaPerson[];
    },
    enabled,
    staleTime: 300_000,
  });
}

export default function LearnAma() {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get("s");

  if (sessionId) {
    return <AmaRoom id={sessionId} onBack={() => setParams({})} />;
  }
  return <AmaList onOpen={(id) => setParams({ s: id })} />;
}

// ── List + archive ──────────────────────────────────────────
function AmaList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["ama-sessions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ama_sessions")
        .select("*, host:profiles!ama_sessions_host_id_fkey(id,name,role,avatar_url)")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as AmaSession[];
    },
    staleTime: 20_000,
  });

  const list = sessions ?? [];
  const live = list.filter((s) => s.status === "live");
  const scheduled = list.filter((s) => s.status === "scheduled");
  const past = list.filter((s) => s.status === "ended");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">AMA Sessions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Ask a teammate anything — fun or professional. Sessions are private to the people invited.
          </p>
        </div>
        <CreateSessionDialog onCreated={onOpen} />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground flex items-center py-12">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : list.length === 0 ? (
        <Card className="p-10 text-center bg-card/60 border-border/30">
          <MessagesSquare className="w-9 h-9 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No sessions yet. Start one with a teammate.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {live.length > 0 && (
            <Section title="Live now" icon={<Radio className="w-4 h-4 text-emerald-400" />}>
              {live.map((s) => <SessionCard key={s.id} s={s} onOpen={onOpen} />)}
            </Section>
          )}
          {scheduled.length > 0 && (
            <Section title="Scheduled" icon={<CalendarClock className="w-4 h-4 text-primary" />}>
              {scheduled.map((s) => <SessionCard key={s.id} s={s} onOpen={onOpen} />)}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="Archive" icon={<MessagesSquare className="w-4 h-4 text-muted-foreground" />}>
              {past.map((s) => <SessionCard key={s.id} s={s} onOpen={onOpen} />)}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

function SessionCard({ s, onOpen }: { s: AmaSession; onOpen: (id: string) => void }) {
  return (
    <Card
      onClick={() => onOpen(s.id)}
      className="p-4 bg-card/60 border-border/30 shadow-lg shadow-black/10 hover:-translate-y-0.5 transition-all cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="secondary" className="text-[10px]">{modeLabel(s.mode)}</Badge>
        {s.status === "live" && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
          </span>
        )}
        {s.status === "scheduled" && (
          <span className="text-[10px] text-muted-foreground">{formatWhen(s.scheduled_at)}</span>
        )}
      </div>
      <h4 className="font-display font-semibold text-foreground">{s.title}</h4>
      {s.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{s.description}</p>}
      <div className="flex items-center gap-2 mt-3">
        <Avatar className="w-6 h-6 ring-1 ring-border/30">
          <AvatarImage src={s.host?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-[9px]">{initials(s.host?.name)}</AvatarFallback>
        </Avatar>
        <span className="text-xs text-muted-foreground">
          {s.host?.name}
          {s.spotlight_ids.length > 0 && ` · ${s.spotlight_ids.length} spotlight${s.spotlight_ids.length === 1 ? "" : "s"}`}
        </span>
      </div>
    </Card>
  );
}

// ── People multi-select ─────────────────────────────────────
function PeopleSelect({
  people,
  value,
  onChange,
  exclude = [],
}: {
  people: AmaPerson[];
  value: string[];
  onChange: (ids: string[]) => void;
  exclude?: string[];
}) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const visible = people.filter((p) => !exclude.includes(p.id));
  return (
    <div className="max-h-40 overflow-y-auto rounded-lg border border-border/40 divide-y divide-border/15">
      {visible.length === 0 && <p className="text-xs text-muted-foreground p-3">No one available.</p>}
      {visible.map((p) => {
        const on = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            className={cn("w-full flex items-center gap-2 px-3 py-2 text-left transition-colors", on ? "bg-primary/10" : "hover:bg-muted/15")}
          >
            <span className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", on ? "bg-primary border-primary" : "border-border")}>
              {on && <Check className="w-3 h-3 text-primary-foreground" />}
            </span>
            <Avatar className="w-6 h-6">
              <AvatarImage src={p.avatar_url ?? undefined} />
              <AvatarFallback className="bg-muted/40 text-[9px]">{initials(p.name)}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-foreground">{p.name}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{p.role}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Create session ──────────────────────────────────────────
function CreateSessionDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: people } = useProfiles(open);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<AmaMode>("both");
  const [spotlights, setSpotlights] = useState<string[]>([]);
  const [invited, setInvited] = useState<string[]>([]);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(30);

  const reset = () => {
    setTitle(""); setDescription(""); setMode("both"); setSpotlights([]);
    setInvited([]); setScheduled(false); setScheduledAt(""); setDuration(30);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in.");
      const t = title.trim();
      if (!t) throw new Error("Give the session a topic.");
      if (spotlights.length === 0) throw new Error("Pick at least one person to be in the spotlight.");
      if (scheduled && !scheduledAt) throw new Error("Pick a date and time.");

      const now = Date.now();
      const base = {
        host_id: user.id,
        title: t,
        description: description.trim() || null,
        mode,
        spotlight_ids: spotlights,
        invited_ids: invited.filter((id) => !spotlights.includes(id)),
        duration_minutes: duration,
      };
      const payload = {
        ...base,
        status: scheduled ? "scheduled" : "live",
        scheduled_at: scheduled ? new Date(scheduledAt).toISOString() : null,
        started_at: scheduled ? null : new Date(now).toISOString(),
        expires_at: scheduled ? null : new Date(now + duration * 60000).toISOString(),
      };

      const { data, error } = await supabase.from("ama_sessions").insert(payload).select("id,status").single();
      if (error) throw error;
      return data as { id: string; status: string };
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["ama-sessions"] });
      toast.success(row.status === "live" ? "Session is live." : "Session scheduled.");
      reset();
      setOpen(false);
      if (row.status === "live") onCreated(row.id);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't create the session."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="rounded-xl shrink-0"><Plus className="w-4 h-4 mr-1.5" /> Start an AMA</Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/40 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Start an AMA</DialogTitle>
          <DialogDescription>Only the people you add — spotlights and invitees — can see or join.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Topic</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Life as a staff engineer" />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What's this session about?" />
          </div>

          <div className="space-y-1.5">
            <Label>Vibe</Label>
            <div className="flex gap-2">
              {AMA_MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  title={m.hint}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                    mode === m.value ? "bg-primary/15 text-primary" : "bg-muted/20 text-muted-foreground hover:bg-muted/30",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>In the spotlight (being asked)</Label>
            <PeopleSelect people={people ?? []} value={spotlights} onChange={setSpotlights} exclude={user ? [user.id] : []} />
          </div>

          <div className="space-y-1.5">
            <Label>Also invite (optional)</Label>
            <PeopleSelect people={people ?? []} value={invited} onChange={setInvited} exclude={[...(user ? [user.id] : []), ...spotlights]} />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setScheduled(false)} className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-colors", !scheduled ? "bg-primary/15 text-primary" : "bg-muted/20 text-muted-foreground hover:bg-muted/30")}>
              Start now
            </button>
            <button onClick={() => setScheduled(true)} className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-colors", scheduled ? "bg-primary/15 text-primary" : "bg-muted/20 text-muted-foreground hover:bg-muted/30")}>
              Schedule
            </button>
          </div>

          {scheduled && (
            <div className="space-y-1.5">
              <Label>When</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Length (minutes)</Label>
            <Input type="number" min={5} value={duration} onChange={(e) => setDuration(Math.max(5, Number(e.target.value) || 5))} />
          </div>
        </div>

        <DialogFooter>
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            {scheduled ? "Schedule" : "Go live"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Session room ────────────────────────────────────────────
function AmaRoom({ id, onBack }: { id: string; onBack: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [nowMs, setNowMs] = useState(Date.now());
  const [draft, setDraft] = useState("");
  const [promptSeed, setPromptSeed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: session, isLoading } = useQuery({
    queryKey: ["ama-session", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ama_sessions")
        .select("*, host:profiles!ama_sessions_host_id_fkey(id,name,role,avatar_url)")
        .eq("id", id)
        .maybeSingle();
      return (data ?? null) as unknown as AmaSession | null;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["ama-messages", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ama_messages")
        .select("*, author:profiles!ama_messages_author_id_fkey(id,name,avatar_url,role)")
        .eq("session_id", id)
        .order("created_at");
      return (data ?? []) as unknown as AmaMessageRow[];
    },
    enabled: !!session,
  });

  const { data: bank } = useQuery({
    queryKey: ["ama-bank"],
    queryFn: async () => {
      const { data } = await supabase.from("ama_question_bank").select("*");
      return (data ?? []) as BankQuestion[];
    },
    staleTime: 600_000,
  });

  // A fresh, stable selection of prompts for this session's mode.
  const shownPrompts = useMemo(() => {
    const pool = (bank ?? []).filter((q) => !session || session.mode === "both" || q.mode === session.mode);
    return seededShuffle(pool, promptSeed).slice(0, 10);
  }, [bank, session, promptSeed]);

  // Tick the clock while live.
  useEffect(() => {
    if (session?.status !== "live") return;
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [session?.status]);

  // Realtime: new messages + session changes.
  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`ama:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ama_messages", filter: `session_id=eq.${id}` }, () =>
        queryClient.invalidateQueries({ queryKey: ["ama-messages", id] }),
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ama_sessions", filter: `id=eq.${id}` }, () =>
        queryClient.invalidateQueries({ queryKey: ["ama-session", id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // Record attendance once when entering a live session.
  useEffect(() => {
    if (!session || !user || session.status === "scheduled") return;
    void supabase.from("ama_participants").upsert({ session_id: id, user_id: user.id }, { onConflict: "session_id,user_id" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, user?.id]);

  // Auto-scroll chat.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages?.length]);

  const isHostOrSpotlight = !!user && !!session && (session.host_id === user.id || session.spotlight_ids.includes(user.id));

  const send = useMutation({
    mutationFn: async ({ body, kind }: { body: string; kind: "chat" | "question" }) => {
      if (!user) throw new Error("Sign in first.");
      const { error } = await supabase.from("ama_messages").insert({ session_id: id, author_id: user.id, kind, body });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ama-messages", id] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't send."),
  });

  const patchSession = useMutation({
    mutationFn: async (patch: Partial<AmaSession>) => {
      const { error } = await supabase.from("ama_sessions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ama-session", id] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't update."),
  });

  const startNow = () =>
    patchSession.mutate({
      status: "live",
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + (session?.duration_minutes ?? 30) * 60000).toISOString(),
    });

  const extend = () => {
    const from = Math.max(new Date(session?.expires_at ?? Date.now()).getTime(), Date.now());
    patchSession.mutate({
      expires_at: new Date(from + EXTEND_MINUTES * 60000).toISOString(),
      extensions: (session?.extensions ?? 0) + 1,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>;
  }
  if (!session) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>This session isn't available — you may not be invited.</p>
        <Button variant="outline" className="mt-4" onClick={onBack}>Back</Button>
      </div>
    );
  }

  const rem = remaining(session.expires_at, nowMs);

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1">
            <ArrowLeft className="w-4 h-4" /> All sessions
          </button>
          <h2 className="font-display text-2xl font-bold text-foreground truncate">{session.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-[10px]">{modeLabel(session.mode)}</Badge>
            {session.status === "live" && (
              <span className={cn("flex items-center gap-1 text-xs font-mono", rem.expired ? "text-amber-400" : "text-emerald-400")}>
                <Clock className="w-3.5 h-3.5" /> {rem.text}{rem.expired ? " over" : ""}
              </span>
            )}
            {session.status === "scheduled" && (
              <span className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> {formatWhen(session.scheduled_at)}</span>
            )}
            {session.status === "ended" && <Badge variant="outline" className="text-[10px]">Ended</Badge>}
          </div>
        </div>

        {isHostOrSpotlight && (
          <div className="flex items-center gap-2 shrink-0">
            {session.status === "scheduled" && (
              <Button size="sm" onClick={startNow}><Play className="w-4 h-4 mr-1.5" /> Start now</Button>
            )}
            {session.status === "live" && (
              <>
                <Button size="sm" variant="outline" onClick={extend}><TimerReset className="w-4 h-4 mr-1.5" /> +{EXTEND_MINUTES}m</Button>
                <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => patchSession.mutate({ status: "ended" })}>
                  <Square className="w-4 h-4 mr-1.5" /> End
                </Button>
              </>
            )}
            {session.host_id === user?.id && <InviteMoreDialog session={session} onDone={() => queryClient.invalidateQueries({ queryKey: ["ama-session", id] })} />}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chat */}
        <Card className="lg:col-span-2 bg-card/60 border-border/30 flex flex-col h-[28rem]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {(messages ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No messages yet. Break the ice with a question.</p>
            ) : (
              (messages ?? []).map((m) => <MessageBubble key={m.id} m={m} mine={m.author_id === user?.id} />)
            )}
          </div>

          {session.status === "live" ? (
            <form
              onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { send.mutate({ body: draft.trim(), kind: "chat" }); setDraft(""); } }}
              className="border-t border-border/30 p-3 flex gap-2"
            >
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message…" className="flex-1" />
              <Button type="submit" disabled={send.isPending || !draft.trim()}><Send className="w-4 h-4" /></Button>
            </form>
          ) : (
            <div className="border-t border-border/30 p-3 text-center text-xs text-muted-foreground">
              {session.status === "scheduled" ? "Chat opens when the session starts." : "This session has ended."}
            </div>
          )}
        </Card>

        {/* Side: question bank + summary */}
        <div className="space-y-4">
          {session.status === "live" && (
            <Card className="p-4 bg-card/60 border-border/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Question prompts</h3>
                </div>
                <button
                  onClick={() => setPromptSeed((s) => s + 1)}
                  title="Shuffle"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {shownPrompts.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => send.mutate({ body: q.prompt, kind: "question" })}
                    className="w-full text-left text-xs text-foreground/90 bg-muted/15 hover:bg-primary/10 rounded-lg px-3 py-2 transition-colors"
                  >
                    {q.prompt}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">Tap one to ask it, or type your own below.</p>
            </Card>
          )}

          <SummaryPanel session={session} canEdit={isHostOrSpotlight} onSave={(text) => patchSession.mutate({ summary: text })} />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ m, mine }: { m: AmaMessageRow; mine: boolean }) {
  if (m.kind === "question") {
    return (
      <div className="flex gap-2 items-start">
        <Sparkles className="w-4 h-4 text-primary mt-1 shrink-0" />
        <div className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-2">
          <p className="text-[10px] text-primary/80 font-medium mb-0.5">{m.author?.name} asked</p>
          <p className="text-sm text-foreground">{m.body}</p>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex gap-2", mine && "flex-row-reverse")}>
      <Avatar className="w-7 h-7 shrink-0">
        <AvatarImage src={m.author?.avatar_url ?? undefined} />
        <AvatarFallback className="bg-muted/40 text-[9px]">{initials(m.author?.name)}</AvatarFallback>
      </Avatar>
      <div className="max-w-[75%]">
        {!mine && <p className="text-[10px] text-muted-foreground mb-0.5">{m.author?.name}</p>}
        <div className={cn("rounded-2xl px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted/25 text-foreground")}>
          {m.body}
        </div>
      </div>
    </div>
  );
}

function SummaryPanel({ session, canEdit, onSave }: { session: AmaSession; canEdit: boolean; onSave: (text: string) => void }) {
  const [text, setText] = useState(session.summary ?? "");
  useEffect(() => setText(session.summary ?? ""), [session.summary]);

  if (session.status !== "ended" && !session.summary) return null;
  return (
    <Card className="p-4 bg-card/60 border-border/30">
      <h3 className="text-sm font-semibold text-foreground mb-2">Recap</h3>
      {canEdit && session.status === "ended" ? (
        <div className="space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="What did the team take away from this session?" />
          <Button size="sm" onClick={() => onSave(text.trim())}>Save recap</Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{session.summary || "No recap yet."}</p>
      )}
    </Card>
  );
}

function InviteMoreDialog({ session, onDone }: { session: AmaSession; onDone: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: people } = useProfiles(open);
  const [picked, setPicked] = useState<string[]>([]);

  const save = useMutation({
    mutationFn: async () => {
      const merged = Array.from(new Set([...session.invited_ids, ...picked]));
      const { error } = await supabase.from("ama_sessions").update({ invited_ids: merged }).eq("id", session.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invites sent."); setPicked([]); setOpen(false); onDone(); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't invite."),
  });

  const exclude = [...(user ? [user.id] : []), ...session.spotlight_ids, ...session.invited_ids];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><UserPlus className="w-4 h-4 mr-1.5" /> Invite</Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/40 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Invite more people</DialogTitle>
          <DialogDescription>They'll be able to see and join this session.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <PeopleSelect people={people ?? []} value={picked} onChange={setPicked} exclude={exclude} />
        </div>
        <DialogFooter>
          <Button disabled={save.isPending || picked.length === 0} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null} Invite {picked.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
