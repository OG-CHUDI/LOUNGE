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
import {
  MessageCircle, Send, Trash2, ExternalLink, ThumbsUp, Laugh, Flame, Heart, Sparkle, type LucideIcon,
} from "lucide-react";

export interface StagePostRow {
  id: string;
  title: string;
  description: string | null;
  link_url: string | null;
  image_url: string | null;
  author_id: string;
  created_at: string | null;
  author: { name: string | null; avatar_url: string | null } | null;
}

export interface StageReactionRow {
  id: string;
  post_id: string;
  user_id: string;
  emoji: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string | null;
}

const REACTIONS: { key: string; Icon: LucideIcon; color: string }[] = [
  { key: "like", Icon: ThumbsUp, color: "text-sky-400" },
  { key: "laugh", Icon: Laugh, color: "text-amber-400" },
  { key: "fire", Icon: Flame, color: "text-orange-400" },
  { key: "love", Icon: Heart, color: "text-rose-400" },
  { key: "wow", Icon: Sparkle, color: "text-fuchsia-400" },
];

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

export default function StagePostCard({ post, reactions }: { post: StagePostRow; reactions: StageReactionRow[] }) {
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

  const { counts, mine } = useMemo(() => {
    const counts: Record<string, number> = {};
    const mine = new Set<string>();
    for (const r of reactions) {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
      if (r.user_id === user?.id) mine.add(r.emoji);
    }
    return { counts, mine };
  }, [reactions, user?.id]);

  const toggleReaction = useMutation({
    mutationFn: async (emoji: string) => {
      if (!user) throw new Error("Not signed in");
      if (mine.has(emoji)) {
        const { error } = await supabase
          .from("stage_reactions")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", user.id)
          .eq("emoji", emoji);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stage_reactions").insert({ post_id: post.id, user_id: user.id, emoji });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stage-reactions"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not react"),
  });

  const deletePost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stage_posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stage-posts"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  const { data: comments } = useQuery({
    queryKey: ["stage-comments", post.id],
    enabled: showComments,
    queryFn: async (): Promise<CommentRow[]> => {
      const { data, error } = await supabase
        .from("stage_comments")
        .select("id, post_id, user_id, body, created_at")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CommentRow[];
    },
    staleTime: 30_000,
  });

  const { data: commentCount } = useQuery({
    queryKey: ["stage-comment-count", post.id],
    queryFn: async (): Promise<number> => {
      const { count } = await supabase
        .from("stage_comments")
        .select("id", { count: "exact", head: true })
        .eq("post_id", post.id);
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  const addComment = useMutation({
    mutationFn: async (body: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("stage_comments").insert({ post_id: post.id, user_id: user.id, body });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentBody("");
      queryClient.invalidateQueries({ queryKey: ["stage-comments", post.id] });
      queryClient.invalidateQueries({ queryKey: ["stage-comment-count", post.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not comment"),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stage_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stage-comments", post.id] });
      queryClient.invalidateQueries({ queryKey: ["stage-comment-count", post.id] });
    },
  });

  const authorName = post.author?.name ?? "Team member";
  const totalComments = commentCount ?? 0;

  return (
    <Card className="break-inside-avoid mb-4 overflow-hidden bg-card/60 border-border/30 rounded-2xl">
      {post.image_url && (
        <div className="bg-muted/20">
          <img src={post.image_url} alt={post.title} loading="lazy" className="w-full h-auto block" />
        </div>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <h3 className="flex-1 font-display font-semibold text-foreground leading-snug">{post.title}</h3>
          {post.author_id === user?.id && (
            <button
              onClick={() => deletePost.mutate()}
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
              title="Delete post"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {post.description && <p className="text-sm text-muted-foreground leading-snug">{post.description}</p>}

        {post.link_url && (
          <a
            href={post.link_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline break-all"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" /> {post.link_url}
          </a>
        )}

        {/* Author + time */}
        <div className="flex items-center gap-2">
          <Avatar className="w-6 h-6 ring-1 ring-border/30">
            <AvatarImage src={post.author?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-[9px]">{initials(authorName)}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-foreground truncate">{authorName}</span>
          <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{relativeTime(post.created_at)}</span>
        </div>

        {/* Reactions */}
        <div className="flex flex-wrap gap-1.5">
          {REACTIONS.map(({ key, Icon, color }) => {
            const active = mine.has(key);
            const count = counts[key] ?? 0;
            return (
              <button
                key={key}
                type="button"
                disabled={toggleReaction.isPending}
                onClick={() => toggleReaction.mutate(key)}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors border ${
                  active ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/10 border-border/30 text-muted-foreground hover:bg-muted/20"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "" : color}`} strokeWidth={2} />
                {count > 0 && <span className="tabular-nums">{count}</span>}
              </button>
            );
          })}
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
      </div>
    </Card>
  );
}
