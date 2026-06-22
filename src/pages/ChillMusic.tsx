import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Disc3, Loader2 } from "lucide-react";
import LoungeRadio from "@/components/music/LoungeRadio";
import NowListeningRail from "@/components/music/NowListeningRail";
import PlaylistCard from "@/components/music/PlaylistCard";
import SharePlaylistDialog from "@/components/music/SharePlaylistDialog";
import type { PlaylistRow } from "@/components/music/types";

export default function ChillMusic() {
  const { data: playlists, isLoading } = useQuery({
    queryKey: ["playlists"],
    queryFn: async (): Promise<PlaylistRow[]> => {
      const { data, error } = await supabase
        .from("playlists")
        .select(
          "id, title, spotify_url, cover_url, curator_id, created_at, curator:profiles!playlists_curator_id_fkey(name, avatar_url)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PlaylistRow[];
    },
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Music</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Lounge radio, team playlists, and what everyone's playing.
        </p>
      </div>

      {/* Radio + now listening */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LoungeRadio />
        </div>
        <div className="lg:col-span-1">
          <NowListeningRail />
        </div>
      </div>

      {/* Team playlists */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Team playlists</h3>
            <p className="text-sm text-muted-foreground">Shared Spotify playlists — play inline (full tracks with Spotify Premium) or open in the app.</p>
          </div>
          <SharePlaylistDialog />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading playlists…
          </div>
        ) : (playlists ?? []).length === 0 ? (
          <Card className="bg-card/60 border-border/30 rounded-2xl p-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-accent/10 flex items-center justify-center mb-4">
              <Disc3 className="w-8 h-8 text-primary/70" />
            </div>
            <h4 className="font-display font-semibold text-foreground">No playlists yet</h4>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Share the first one. Drop a Spotify link and the whole team can tune in.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {(playlists ?? []).map((p) => (
              <PlaylistCard key={p.id} playlist={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
