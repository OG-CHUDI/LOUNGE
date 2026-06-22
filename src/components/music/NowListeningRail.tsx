import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/hooks/useTeam";
import { Headphones, Loader2, Music } from "lucide-react";
import type { ListeningRow } from "./types";

export default function NowListeningRail() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data: listeners } = useQuery({
    queryKey: ["listening-now"],
    queryFn: async (): Promise<ListeningRow[]> => {
      const { data, error } = await supabase
        .from("listening_now")
        .select(
          "user_id, track_title, updated_at, user:profiles!listening_now_user_id_fkey(name, avatar_url)"
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ListeningRow[];
    },
    staleTime: 10_000,
    refetchInterval: 30_000, // fallback if realtime isn't enabled for the table
  });

  // Realtime: any change to listening_now → refetch the rail.
  useEffect(() => {
    const channel = supabase
      .channel("listening-now")
      .on("postgres_changes", { event: "*", schema: "public", table: "listening_now" }, () => {
        queryClient.invalidateQueries({ queryKey: ["listening-now"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const setListening = useMutation({
    mutationFn: async (track: string) => {
      if (!user) throw new Error("You need to be signed in.");
      const value = track.trim();
      const { error } = await supabase.from("listening_now").upsert(
        {
          user_id: user.id,
          track_title: value || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listening-now"] });
      toast.success("Updated what you're listening to.");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Couldn't update.");
    },
  });

  const active = (listeners ?? []).filter((l) => l.track_title?.trim());

  return (
    <Card className="p-5 bg-card/60 border-border/30 rounded-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Headphones className="w-4 h-4 text-primary" />
        <h3 className="font-display font-semibold text-foreground">Now listening</h3>
      </div>

      {/* Set your own */}
      <div className="flex gap-2 mb-4">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !setListening.isPending) setListening.mutate(draft);
          }}
          placeholder="What are you listening to?"
          maxLength={120}
          className="rounded-xl bg-background/50 border-border/40"
        />
        <Button
          onClick={() => setListening.mutate(draft)}
          disabled={setListening.isPending}
          variant="secondary"
          className="rounded-xl shrink-0"
        >
          {setListening.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set"}
        </Button>
      </div>

      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nobody's shared a track yet. Be the first.
        </p>
      ) : (
        <div className="space-y-3">
          {active.map((l) => (
            <div key={l.user_id} className="flex items-center gap-3">
              <Avatar className="h-9 w-9 shrink-0">
                {l.user?.avatar_url && <AvatarImage src={l.user.avatar_url} alt={l.user?.name ?? ""} />}
                <AvatarFallback className="text-xs bg-muted/40 text-muted-foreground">
                  {initials(l.user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{l.user?.name ?? "Someone"}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                  <Music className="w-3 h-3 shrink-0" />
                  <span className="truncate">{l.track_title}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
