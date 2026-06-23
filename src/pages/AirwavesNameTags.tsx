import { useEffect, useState } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, BadgeCheck, Volume2 } from "lucide-react";
import RecorderControls from "@/components/airwaves/RecorderControls";
import AudioPlayer from "@/components/airwaves/AudioPlayer";

interface NameTagRow {
  user_id: string;
  audio_url: string;
  note: string | null;
  updated_at: string | null;
  user: { name: string | null; avatar_url: string | null } | null;
}

const MAX_SECONDS = 8;

export default function AirwavesNameTags() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const recorder = useAudioRecorder(MAX_SECONDS);
  const [note, setNote] = useState("");

  const { data: tags, isLoading } = useQuery({
    queryKey: ["name-tags"],
    queryFn: async (): Promise<NameTagRow[]> => {
      const { data, error } = await supabase
        .from("name_tags")
        .select("user_id, audio_url, note, updated_at, user:profiles!name_tags_user_id_fkey(name, avatar_url)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as NameTagRow[];
    },
    staleTime: 30_000,
  });

  const mine = (tags ?? []).find((t) => t.user_id === user?.id) ?? null;

  useEffect(() => {
    const channel = supabase
      .channel("name-tags")
      .on("postgres_changes", { event: "*", schema: "public", table: "name_tags" }, () =>
        queryClient.invalidateQueries({ queryKey: ["name-tags"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!recorder.blob) throw new Error("Record your name first");
      const url = await uploadToBucket("airwaves", `${user.id}/name/${Date.now()}.webm`, recorder.blob, recorder.blob.type);
      const { error } = await supabase
        .from("name_tags")
        .upsert({ user_id: user.id, audio_url: url, note: note.trim() || null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Name tag saved.");
      recorder.reset();
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["name-tags"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <BadgeCheck className="w-6 h-6 text-primary" strokeWidth={1.5} /> Name Tags
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Record how to say your name so nobody has to guess. A small thing that means a lot on a distributed team.
        </p>
      </div>

      {/* Your tag */}
      <Card className="p-4 bg-card/60 border-border/30 rounded-2xl space-y-3">
        <h3 className="font-display font-semibold text-foreground">Your name tag</h3>
        {mine && !recorder.blob && (
          <div className="space-y-1.5">
            <AudioPlayer src={mine.audio_url} />
            {mine.note && <p className="text-xs text-muted-foreground">“{mine.note}”</p>}
          </div>
        )}
        <RecorderControls recorder={recorder} maxSeconds={MAX_SECONDS} label={mine ? "Re-record name" : "Record name"} />
        {recorder.blob && (
          <div className="flex items-center gap-2">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Phonetic spelling (optional), e.g. choo-dee"
              maxLength={80}
              className="bg-background/50"
            />
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-xl shrink-0">
              {save.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Save
            </Button>
          </div>
        )}
      </Card>

      {/* The directory */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Volume2 className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground">Team name tags</h3>
          <span className="text-xs text-muted-foreground">({tags?.length ?? 0})</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : tags && tags.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {tags.map((t) => (
              <Card key={t.user_id} className="p-3 bg-card/60 border-border/30 rounded-2xl flex items-center gap-3">
                <Avatar className="w-9 h-9 ring-1 ring-border/30 shrink-0">
                  <AvatarImage src={t.user?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">{initials(t.user?.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{t.user?.name ?? "Team member"}</p>
                  {t.note && <p className="text-[11px] text-muted-foreground truncate">“{t.note}”</p>}
                  <div className="mt-1.5">
                    <AudioPlayer src={t.audio_url} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-10 bg-card/40 border-border/20 text-center">
            <BadgeCheck className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No name tags yet. Record yours above to start the directory.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
