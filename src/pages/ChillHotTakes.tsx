import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Flame, Loader2, Send } from "lucide-react";
import HotTakeCard, { type HotTakeRow, type VoteRow } from "@/components/hottakes/HotTakeCard";

export default function ChillHotTakes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data: takes, isLoading } = useQuery({
    queryKey: ["hot-takes"],
    queryFn: async (): Promise<HotTakeRow[]> => {
      const { data, error } = await supabase
        .from("hot_takes")
        .select("id, body, author_id, created_at, author:profiles!hot_takes_author_id_fkey(name, avatar_url)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as HotTakeRow[];
    },
    staleTime: 15_000,
  });

  const takeIds = (takes ?? []).map((t) => t.id);
  const { data: votes } = useQuery({
    queryKey: ["hot-take-votes"],
    enabled: takeIds.length > 0,
    queryFn: async (): Promise<VoteRow[]> => {
      const { data, error } = await supabase
        .from("hot_take_votes")
        .select("take_id, user_id, vote")
        .in("take_id", takeIds);
      if (error) throw error;
      return (data ?? []) as VoteRow[];
    },
    staleTime: 15_000,
  });

  const votesByTake = (votes ?? []).reduce<Record<string, VoteRow[]>>((acc, v) => {
    (acc[v.take_id] ??= []).push(v);
    return acc;
  }, {});

  // Realtime: takes / votes / comments → refetch.
  useEffect(() => {
    const channel = supabase
      .channel("hot-takes")
      .on("postgres_changes", { event: "*", schema: "public", table: "hot_takes" }, () =>
        queryClient.invalidateQueries({ queryKey: ["hot-takes"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "hot_take_votes" }, () =>
        queryClient.invalidateQueries({ queryKey: ["hot-take-votes"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "hot_take_comments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["hot-take-comments"] });
        queryClient.invalidateQueries({ queryKey: ["hot-take-comment-count"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const post = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const body = draft.trim();
      if (!body) throw new Error("Type your hot take first");
      const { error } = await supabase.from("hot_takes").insert({ author_id: user.id, body });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["hot-takes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not post"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-400" strokeWidth={1.5} /> Hot Takes
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Drop a spicy opinion. The team votes Agree or Disagree — and argues in the comments.
        </p>
      </div>

      {/* Post a take */}
      <Card className="p-4 bg-card/60 border-border/30 rounded-2xl space-y-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Tabs beat spaces. Standups are a waste. Fight me."
          rows={2}
          maxLength={280}
          className="bg-background/50 border-border/40 resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{draft.length}/280</span>
          <Button onClick={() => post.mutate()} disabled={post.isPending || !draft.trim()} className="rounded-xl">
            {post.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
            Post take
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading takes…
        </div>
      ) : takes && takes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {takes.map((t) => (
            <HotTakeCard key={t.id} take={t} votes={votesByTake[t.id] ?? []} />
          ))}
        </div>
      ) : (
        <Card className="p-10 bg-card/40 border-border/20 text-center">
          <Flame className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No takes yet. Be brave — post the first one.</p>
        </Card>
      )}
    </div>
  );
}
