import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadToBucket } from "@/lib/storage";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, ImagePlus, Loader2, Plus, Upload } from "lucide-react";
import MemeCard, { type MemeRow, type ReactionRow } from "./MemeCard";

export interface Wall {
  id: string;
  title: string;
  created_at: string | null;
  created_by: string | null;
}

export default function MemeWall({ wall, onBack }: { wall: Wall; onBack: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const { data: memes } = useQuery({
    queryKey: ["memes", wall.id],
    queryFn: async (): Promise<MemeRow[]> => {
      const { data, error } = await supabase
        .from("memes")
        .select(
          "id, image_url, caption, poster_id, wall_id, created_at, poster:profiles!memes_poster_id_fkey(name, avatar_url)"
        )
        .eq("wall_id", wall.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MemeRow[];
    },
    staleTime: 15_000,
  });

  // One query for all reactions on this wall's memes, grouped client-side.
  const memeIds = (memes ?? []).map((m) => m.id);
  const { data: reactions } = useQuery({
    queryKey: ["meme-reactions", wall.id],
    enabled: memeIds.length > 0,
    queryFn: async (): Promise<ReactionRow[]> => {
      const { data, error } = await supabase
        .from("meme_reactions")
        .select("id, meme_id, user_id, emoji")
        .in("meme_id", memeIds);
      if (error) throw error;
      return (data ?? []) as ReactionRow[];
    },
    staleTime: 15_000,
  });

  const reactionsByMeme = (reactions ?? []).reduce<Record<string, ReactionRow[]>>((acc, r) => {
    (acc[r.meme_id] ??= []).push(r);
    return acc;
  }, {});

  // Realtime: any change to this wall's memes / reactions / comments → refetch.
  useEffect(() => {
    const channel = supabase
      .channel(`wall-${wall.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "memes", filter: `wall_id=eq.${wall.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["memes", wall.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meme_reactions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["meme-reactions", wall.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meme_comments" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["meme-comments"] });
          queryClient.invalidateQueries({ queryKey: ["meme-comment-count"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [wall.id, queryClient]);

  const resetForm = () => {
    setCaption("");
    setImageUrl("");
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onPickFile = (f: File | null) => {
    setFile(f);
    if (f) {
      setImageUrl("");
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const addPin = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      let url = imageUrl.trim();
      if (file) {
        url = await uploadToBucket("memes", `${user.id}/${Date.now()}-${file.name}`, file);
      }
      if (!url) throw new Error("Add an image file or URL");
      const { error } = await supabase.from("memes").insert({
        wall_id: wall.id,
        image_url: url,
        poster_id: user.id,
        caption: caption.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pinned!");
      resetForm();
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["memes", wall.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not post"),
  });

  const canSubmit = (!!file || !!imageUrl.trim()) && !addPin.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All walls
          </button>
          <h2 className="font-display text-2xl font-bold text-foreground truncate">{wall.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {(memes?.length ?? 0)} pin{(memes?.length ?? 0) === 1 ? "" : "s"}
          </p>
        </div>

        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="shrink-0 rounded-2xl">
              <Plus className="w-4 h-4" /> Add a pin
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border/30">
            <DialogHeader>
              <DialogTitle className="font-display">Add a pin</DialogTitle>
              <DialogDescription>Upload an image or paste a link, then caption it.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Preview */}
              {preview || imageUrl.trim() ? (
                <div className="rounded-xl overflow-hidden border border-border/30 bg-muted/20">
                  <img
                    src={preview ?? imageUrl.trim()}
                    alt="preview"
                    className="w-full h-auto max-h-64 object-contain"
                  />
                </div>
              ) : null}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" /> {file ? "Change image" : "Upload image"}
              </Button>

              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="h-px flex-1 bg-border/30" /> or paste a URL{" "}
                <span className="h-px flex-1 bg-border/30" />
              </div>

              <Input
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  if (e.target.value) {
                    setFile(null);
                    setPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }
                }}
                placeholder="https://…/funny.gif"
                disabled={!!file}
              />

              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption (optional)"
              />
            </div>

            <DialogFooter>
              <Button onClick={() => addPin.mutate()} disabled={!canSubmit} className="rounded-xl">
                {addPin.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Posting…
                  </>
                ) : (
                  <>
                    <ImagePlus className="w-4 h-4" /> Post it
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {memes && memes.length === 0 ? (
        <div className="rounded-2xl border border-border/30 bg-card/40 py-16 text-center">
          <p className="text-sm text-muted-foreground">No memes yet — be the first to post one!</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
          {(memes ?? []).map((m) => (
            <MemeCard key={m.id} meme={m} reactions={reactionsByMeme[m.id] ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}
