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
  ImageOff,
  MessageCircle,
  Send,
  Trash2,
  ThumbsUp,
  Laugh,
  Flame,
  Heart,
  Sparkle,
  type LucideIcon,
} from "lucide-react";

export interface MemePoster {
  name: string | null;
  avatar_url: string | null;
}

export interface MemeRow {
  id: string;
  image_url: string;
  caption: string | null;
  poster_id: string;
  wall_id: string | null;
  created_at: string | null;
  poster: MemePoster | null;
}

export interface ReactionRow {
  id: string;
  meme_id: string;
  user_id: string;
  emoji: string;
}

export interface CommentRow {
  id: string;
  meme_id: string;
  user_id: string;
  body: string;
  created_at: string | null;
}

// Reaction identifiers are stored in the `emoji` column as stable keys and
// rendered as lucide icons (no emoji in the UI).
const REACTIONS: { key: string; Icon: LucideIcon; color: string }[] = [
  { key: "like", Icon: ThumbsUp, color: "text-sky-400" },
  { key: "laugh", Icon: Laugh, color: "text-amber-400" },
  { key: "fire", Icon: Flame, color: "text-orange-400" },
  { key: "love", Icon: Heart, color: "text-rose-400" },
  { key: "wow", Icon: Sparkle, color: "text-fuchsia-400" },
];

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

export default function MemeCard({
  meme,
  reactions,
}: {
  meme: MemeRow;
  reactions: ReactionRow[];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: team } = useTeam();
  const [imgError, setImgError] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentBody, setCommentBody] = useState("");

  const profileById = useMemo(() => {
    const map = new Map<string, { name: string | null; avatar_url: string | null }>();
    (team ?? []).forEach((m) => map.set(m.id, { name: m.name, avatar_url: m.avatar_url }));
    return map;
  }, [team]);

  // Aggregate reaction counts + which emojis the current user has reacted with.
  const { counts, mine } = useMemo(() => {
    const counts: Record<string, number> = {};
    const mine = new Set<string>();
    for (const r of reactions) {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
      if (r.user_id === user?.id) mine.add(r.emoji);
    }
    return { counts, mine };
  }, [reactions, user?.id]);

  const { data: comments } = useQuery({
    queryKey: ["meme-comments", meme.id],
    enabled: showComments,
    queryFn: async (): Promise<CommentRow[]> => {
      const { data, error } = await supabase
        .from("meme_comments")
        .select("id, meme_id, user_id, body, created_at")
        .eq("meme_id", meme.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CommentRow[];
    },
    staleTime: 30_000,
  });

  // Cheap count without opening the thread.
  const { data: commentCount } = useQuery({
    queryKey: ["meme-comment-count", meme.id],
    queryFn: async (): Promise<number> => {
      const { count } = await supabase
        .from("meme_comments")
        .select("id", { count: "exact", head: true })
        .eq("meme_id", meme.id);
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  const toggleReaction = useMutation({
    mutationFn: async (emoji: string) => {
      if (!user) throw new Error("Not signed in");
      if (mine.has(emoji)) {
        const { error } = await supabase
          .from("meme_reactions")
          .delete()
          .eq("meme_id", meme.id)
          .eq("user_id", user.id)
          .eq("emoji", emoji);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("meme_reactions")
          .insert({ meme_id: meme.id, user_id: user.id, emoji });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      if (meme.wall_id) {
        queryClient.invalidateQueries({ queryKey: ["meme-reactions", meme.wall_id] });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not react"),
  });

  const addComment = useMutation({
    mutationFn: async (body: string) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("meme_comments")
        .insert({ meme_id: meme.id, user_id: user.id, body });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentBody("");
      queryClient.invalidateQueries({ queryKey: ["meme-comments", meme.id] });
      queryClient.invalidateQueries({ queryKey: ["meme-comment-count", meme.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not comment"),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meme_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meme-comments", meme.id] });
      queryClient.invalidateQueries({ queryKey: ["meme-comment-count", meme.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete comment"),
  });

  const posterName = meme.poster?.name ?? "Team member";
  const totalComments = commentCount ?? 0;

  return (
    <Card className="break-inside-avoid mb-4 overflow-hidden bg-card/60 border-border/30 rounded-2xl">
      {/* Image */}
      <div className="bg-muted/20">
        {imgError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground/60">
            <ImageOff className="w-8 h-8" />
            <span className="text-xs">Image unavailable</span>
          </div>
        ) : (
          <img
            src={meme.image_url}
            alt={meme.caption ?? "meme"}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-auto block"
          />
        )}
      </div>

      <div className="p-3 space-y-3">
        {meme.caption && <p className="text-sm text-foreground leading-snug">{meme.caption}</p>}

        {/* Poster + time */}
        <div className="flex items-center gap-2">
          <Avatar className="w-6 h-6 ring-1 ring-border/30">
            <AvatarImage src={meme.poster?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-[9px]">
              {initials(posterName)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-foreground truncate">{posterName}</span>
          <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
            {relativeTime(meme.created_at)}
          </span>
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
                  active
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-muted/10 border-border/30 text-muted-foreground hover:bg-muted/20"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "" : color}`} strokeWidth={2} />
                {count > 0 && <span className="tabular-nums">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Comments toggle */}
        <button
          type="button"
          onClick={() => setShowComments((s) => !s)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {totalComments === 0
            ? "Add a comment"
            : `${totalComments} comment${totalComments === 1 ? "" : "s"}`}
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
                      <AvatarFallback className="bg-primary/20 text-primary text-[8px]">
                        {initials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">
                        <span className="font-medium">{name}</span>{" "}
                        <span className="text-muted-foreground">{c.body}</span>
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {relativeTime(c.created_at)}
                      </span>
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
              {comments && comments.length === 0 && (
                <p className="text-[11px] text-muted-foreground">No comments yet.</p>
              )}
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
              <Button
                type="submit"
                size="icon"
                className="h-8 w-8 shrink-0"
                disabled={addComment.isPending || !commentBody.trim()}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        )}
      </div>
    </Card>
  );
}
