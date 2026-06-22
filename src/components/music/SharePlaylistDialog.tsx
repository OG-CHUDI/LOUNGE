import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
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
import { Plus, Loader2, Share2 } from "lucide-react";
import { isSpotifyUrl } from "./spotify";

export default function SharePlaylistDialog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const reset = () => {
    setTitle("");
    setSpotifyUrl("");
    setCoverUrl("");
  };

  const share = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You need to be signed in.");
      const t = title.trim();
      const link = spotifyUrl.trim();
      if (!t) throw new Error("Give your playlist a title.");
      if (!isSpotifyUrl(link)) throw new Error("That doesn't look like a Spotify link.");

      const { error } = await supabase.from("playlists").insert({
        title: t,
        spotify_url: link,
        cover_url: coverUrl.trim() || null,
        curator_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      toast.success("Playlist shared with the team.");
      reset();
      setOpen(false);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Couldn't share playlist.");
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="rounded-xl">
          <Plus className="w-4 h-4 mr-1.5" />
          Share a playlist
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/40 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            Share a playlist
          </DialogTitle>
          <DialogDescription>
            Paste a Spotify link. Everyone on the team will see it here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Friday afternoon focus"
              maxLength={120}
              className="rounded-xl bg-background/50 border-border/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Spotify URL</label>
            <Input
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrl(e.target.value)}
              placeholder="https://open.spotify.com/playlist/…"
              className="rounded-xl bg-background/50 border-border/40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Cover image URL <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…"
              className="rounded-xl bg-background/50 border-border/40"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => share.mutate()}
            disabled={share.isPending}
            className="rounded-xl"
          >
            {share.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Share"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
