import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadToBucket } from "@/lib/storage";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mic, Send } from "lucide-react";
import RecorderControls from "@/components/airwaves/RecorderControls";
import VoiceNoteCard, { type VoiceNoteRow, type VoiceReactionRow } from "@/components/airwaves/VoiceNoteCard";

const MAX_SECONDS = 90;

export default function AirwavesVoiceNotes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const recorder = useAudioRecorder(MAX_SECONDS);
  const [caption, setCaption] = useState("");

  const { data: notes, isLoading } = useQuery({
    queryKey: ["voice-notes"],
    queryFn: async (): Promise<VoiceNoteRow[]> => {
      const { data, error } = await supabase
        .from("voice_notes")
        .select(
          "id, audio_url, caption, duration_seconds, author_id, created_at, author:profiles!voice_notes_author_id_fkey(name, avatar_url)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as VoiceNoteRow[];
    },
    staleTime: 15_000,
  });

  const noteIds = (notes ?? []).map((n) => n.id);
  const { data: reactions } = useQuery({
    queryKey: ["voice-note-reactions"],
    enabled: noteIds.length > 0,
    queryFn: async (): Promise<VoiceReactionRow[]> => {
      const { data, error } = await supabase
        .from("voice_note_reactions")
        .select("id, note_id, user_id, emoji")
        .in("note_id", noteIds);
      if (error) throw error;
      return (data ?? []) as VoiceReactionRow[];
    },
    staleTime: 15_000,
  });

  const reactionsByNote = (reactions ?? []).reduce<Record<string, VoiceReactionRow[]>>((acc, r) => {
    (acc[r.note_id] ??= []).push(r);
    return acc;
  }, {});

  useEffect(() => {
    const channel = supabase
      .channel("voice-notes")
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_notes" }, () =>
        queryClient.invalidateQueries({ queryKey: ["voice-notes"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_note_reactions" }, () =>
        queryClient.invalidateQueries({ queryKey: ["voice-note-reactions"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_note_comments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["voice-note-comments"] });
        queryClient.invalidateQueries({ queryKey: ["voice-note-comment-count"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const post = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      if (!recorder.blob) throw new Error("Record something first");
      const url = await uploadToBucket("airwaves", `${user.id}/voice/${Date.now()}.webm`, recorder.blob, recorder.blob.type);
      const { error } = await supabase.from("voice_notes").insert({
        author_id: user.id,
        audio_url: url,
        caption: caption.trim() || null,
        duration_seconds: recorder.seconds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Voice note posted!");
      recorder.reset();
      setCaption("");
      queryClient.invalidateQueries({ queryKey: ["voice-notes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not post"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Mic className="w-6 h-6 text-primary" strokeWidth={1.5} /> Voice Notes
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Say it out loud. Record a quick note (up to {MAX_SECONDS}s) and the team can listen, react and reply.
        </p>
      </div>

      {/* Composer */}
      <Card className="p-4 bg-card/60 border-border/30 rounded-2xl space-y-3 max-w-xl">
        <RecorderControls recorder={recorder} maxSeconds={MAX_SECONDS} label="Record a note" />
        {recorder.blob && (
          <div className="flex items-center gap-2">
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption (optional)"
              maxLength={140}
              className="bg-background/50"
            />
            <Button onClick={() => post.mutate()} disabled={post.isPending} className="rounded-xl shrink-0">
              {post.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              Post
            </Button>
          </div>
        )}
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading notes…
        </div>
      ) : notes && notes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {notes.map((n) => (
            <VoiceNoteCard key={n.id} note={n} reactions={reactionsByNote[n.id] ?? []} />
          ))}
        </div>
      ) : (
        <Card className="p-10 bg-card/40 border-border/20 text-center">
          <Mic className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No voice notes yet — be the first to break the silence.</p>
        </Card>
      )}
    </div>
  );
}
