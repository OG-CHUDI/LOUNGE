import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useTeam, initials } from "@/hooks/useTeam";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThumbsUp, ThumbsDown, MessageCircle, Send, Trash2 } from "lucide-react";

export interface HotTakeRow {
  id: string;
  body: string;
  author_id: string;
  created_at: string | null;
  author: { name: string | null; avatar_url: string | null } | null;
}

export interface VoteRow {
  take_id: string;
  user_id: string;
  vote: "agree" | "disagree";
}

interface CommentRow {
  id: string;
  take_id: string;
  user_id: string;
  body: string;
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
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

export default function HotTakeCard({ take, votes }: { take: HotTakeRow; votes: VoteRow[] }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: team } = useTeam();
  const [showComments, setShowComments] = useState(false);
  const [commentBody, setCommentBody] = useState("");

  const profileById = useMemo(() => {
    const map = new Map<string, { name: string | null; avatar_url: string | null }>();
    (team ?? []).forEach((m) => map.set(m.id, { name: m.name, avatar_url: m.avatar_url }));
    return map;
  }, [team]);

  const { agree, disagree, mine } = useMemo(() => {
    let agree = 0;
    let disagree = 0;
    let mine: "agree" | "disagree" | null = null;
    for (const v of votes) {
      if (v.vote === "agree") agree++;
      else disagree++;
      if (v.user_id === user?.id) mine = v.vote;
    }
    return { agree, disagree, mine };
  }, [votes, user?.id]);

  const total = agree + disagree;
  const agreePct = total > 0 ? Math.round((agree / total) * 100) : 50;

  const setVote = useMutation({
    mutationFn: async (vote: "agree" | "disagree") => {
      if (!user) throw new Error("Not signed in");
      if (mine === vote) {
        const { error } = await supabase
          .from("hot_take_votes")
          .delete()
          .eq("take_id", take.id)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("hot_take_votes")
          .upsert({ take_id: take.id, user_id: user.id, vote }, { onConflict: "take_id,user_id" });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hot-take-votes"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not vote"),
  });

  const deleteTake = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hot_takes").delete().eq("id", take.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hot-takes"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  const { data: comments } = useQuery({
    queryKey: ["hot-take-comments", take.id],
    enabled: showComments,
    queryFn: async (): Promise<CommentRow[]> => {
      const { data, error } = await supabase
        .from("hot_take_comments")
        .select("id, take_id, user_id, body, created_at")
        .eq("take_id", take.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CommentRow[];
    },
    staleTime: 30_000,
  });

  const { data: commentCount } = useQuery({
    queryKey: ["hot-take-comment-count", take.id],
    queryFn: async (): Promise<number> => {
      const { count } = await supabase
        .from("hot_take_comments")
        .select("id", { count: "exact", head: true })
        .eq("take_id", take.id);
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  const addComment = useMutation({
    mutationFn: async (body: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("hot_take_comments")
        .insert({ take_id: take.id, user_id: user.id, body });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentBody("");
      queryClient.invalidateQueries({ queryKey: ["hot-take-comments", take.id] });
      queryClient.invalidateQueries({ queryKey: ["hot-take-comment-count", take.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not comment"),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hot_take_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hot-take-comments", take.id] });
      queryClient.invalidateQueries({ queryKey: ["hot-take-comment-count", take.id] });
    },
  });

  const authorName = take.author?.name ?? "Team member";
  const totalComments = commentCount ?? 0;

  return (
    <Card className="p-4 bg-card/60 border-border/30 rounded-2xl space-y-3">
      {/* Take body */}
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none mt-0.5">🔥</span>
        <p className="flex-1 text-sm text-foreground font-medium leading-snug">{take.body}</p>
        {take.author_id === user?.id && (
          <button
            onClick={() => deleteTake.mutate()}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            title="Delete take"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Author + time */}
      <div className="flex items-center gap-2">
        <Avatar className="w-5 h-5 ring-1 ring-border/30">
          <AvatarImage src={take.author?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-[8px]">{initials(authorName)}</AvatarFallback>
        </Avatar>
        <span className="text-xs text-muted-foreground">{authorName}</span>
        <span className="text-[11px] text-muted-foreground ml-auto">{relativeTime(take.created_at)}</span>
      </div>

      {/* Vote tally bar */}
      <div className="h-1.5 rounded-full overflow-hidden bg-rose-500/30 flex">
        <div className="bg-emerald-500/70 transition-all" style={{ width: `${agreePct}%` }} />
      </div>

      {/* Vote buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={setVote.isPending}
          onClick={() => setVote.mutate("agree")}
          className={`flex-1 rounded-xl gap-1.5 ${mine === "agree" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300" : ""}`}
        >
          <ThumbsUp className="w-3.5 h-3.5" /> Agree <span className="tabular-nums">{agree}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={setVote.isPending}
          onClick={() => setVote.mutate("disagree")}
          className={`flex-1 rounded-xl gap-1.5 ${mine === "disagree" ? "bg-rose-500/15 border-rose-500/40 text-rose-300" : ""}`}
        >
          <ThumbsDown className="w-3.5 h-3.5" /> Disagree <span className="tabular-nums">{disagree}</span>
        </Button>
      </div>

      {/* Comments */}
      <button
        type="button"
        onClick={() => setShowComments((s) => !s)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {totalComments === 0 ? "Add a comment" : `${totalComments} comment${totalComments === 1 ? "" : "s"}`}
      </button>

      {showComments && (
        <div className="space-y-3 pt-1">
          <div className="space-y-2">
            {(comments ?? []).map((c) => {
              const p = profileById.get(c.user_id);
              const name = p?.name ?? "Team member";
              return (
                <div key={c.id} className="flex items-start gap-2 group">
                  <Avatar className="w-5 h-5 mt-0.5 ring-1 ring-border/30">
                    <AvatarImage src={p?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-[8px]">{initials(name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">
                      <span className="font-medium">{name}</span> <span className="text-muted-foreground">{c.body}</span>
                    </p>
                    <span className="text-[10px] text-muted-foreground">{relativeTime(c.created_at)}</span>
                  </div>
                  {c.user_id === user?.id && (
                    <button
                      type="button"
                      onClick={() => deleteComment.mutate(c.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {comments && comments.length === 0 && <p className="text-[11px] text-muted-foreground">No comments yet.</p>}
          </div>

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const body = commentBody.trim();
              if (!body) return;
              addComment.mutate(body);
            }}
          >
            <Input
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Add a comment…"
              className="h-8 text-xs bg-background/60"
            />
            <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={addComment.isPending || !commentBody.trim()}>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}
