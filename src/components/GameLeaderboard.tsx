import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { gameByKey } from "@/lib/games";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/hooks/useTeam";
import { Trophy } from "lucide-react";

interface Row {
  user_id: string;
  value: number;
  name: string | null;
  avatar_url: string | null;
}

export default function GameLeaderboard({ gameKey, limit = 10 }: { gameKey: string; limit?: number }) {
  const { user } = useAuth();
  const def = gameByKey(gameKey);

  const { data: rows } = useQuery({
    queryKey: ["leaderboard", gameKey],
    queryFn: async (): Promise<Row[]> => {
      const { data } = await supabase
        .from("game_scores")
        .select("user_id, score, user:profiles!game_scores_user_id_fkey(name, avatar_url)")
        .eq("game_key", gameKey);

      const byUser = new Map<string, Row>();
      for (const r of (data ?? []) as any[]) {
        const existing = byUser.get(r.user_id);
        const next: Row = {
          user_id: r.user_id,
          value: r.score,
          name: r.user?.name ?? null,
          avatar_url: r.user?.avatar_url ?? null,
        };
        if (!existing) {
          byUser.set(r.user_id, next);
        } else if (def?.aggregate === "sum") {
          existing.value += r.score;
        } else if (r.score > existing.value) {
          existing.value = r.score;
        }
      }
      return [...byUser.values()].sort((a, b) => b.value - a.value).slice(0, limit);
    },
    staleTime: 15_000,
  });

  const fmt = def?.formatScore ?? ((s: number) => `${s}`);

  return (
    <div className="rounded-2xl border border-border/30 bg-card/60 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h3 className="font-display text-sm font-semibold text-foreground">Leaderboard</h3>
        {def && <span className="ml-auto text-[10px] text-muted-foreground">{def.metricLabel}</span>}
      </div>
      {rows && rows.length > 0 ? (
        <div className="divide-y divide-border/15">
          {rows.map((r, idx) => {
            const isMe = r.user_id === user?.id;
            return (
              <div
                key={r.user_id}
                className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? "bg-primary/5" : ""}`}
              >
                <div className="w-6 text-center text-sm">
                  {idx === 0 ? (
                    <Trophy className="w-4 h-4 text-amber-400 inline" />
                  ) : idx === 1 ? (
                    <Trophy className="w-4 h-4 text-slate-300 inline" />
                  ) : idx === 2 ? (
                    <Trophy className="w-4 h-4 text-amber-700 inline" />
                  ) : (
                    <span className="text-muted-foreground font-medium">{idx + 1}</span>
                  )}
                </div>
                <Avatar className="w-7 h-7 ring-1 ring-border/30">
                  <AvatarImage src={r.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                    {initials(r.name)}
                  </AvatarFallback>
                </Avatar>
                <span className={`flex-1 text-sm truncate ${isMe ? "text-primary font-medium" : "text-foreground"}`}>
                  {r.name ?? "Player"}
                  {isMe && <span className="text-[10px] text-primary ml-1.5">(you)</span>}
                </span>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">{fmt(r.value)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-10 text-center">
          <Trophy className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No scores yet. Be the first on the board!</p>
        </div>
      )}
    </div>
  );
}
