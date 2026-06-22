import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/hooks/useTeam";
import { Disc3, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { toSpotifyEmbedUrl } from "./spotify";
import type { PlaylistRow } from "./types";

export default function PlaylistCard({ playlist }: { playlist: PlaylistRow }) {
  const [showPreview, setShowPreview] = useState(false);
  const embedUrl = toSpotifyEmbedUrl(playlist.spotify_url);
  const curatorName = playlist.curator?.name ?? "Someone";

  return (
    <Card className="overflow-hidden bg-card/60 border-border/30 rounded-2xl flex flex-col">
      {/* Cover */}
      <div className="relative h-40 w-full overflow-hidden">
        {playlist.cover_url ? (
          <img
            src={playlist.cover_url}
            alt={playlist.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/30 via-primary/10 to-accent/10 flex items-center justify-center">
            <Disc3 className="w-14 h-14 text-primary/70" />
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-foreground truncate">{playlist.title}</h3>
          <div className="flex items-center gap-2 mt-2">
            <Avatar className="h-6 w-6">
              {playlist.curator?.avatar_url && (
                <AvatarImage src={playlist.curator.avatar_url} alt={curatorName} />
              )}
              <AvatarFallback className="text-[10px] bg-muted/40 text-muted-foreground">
                {initials(playlist.curator?.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">{curatorName}</span>
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2">
          <Button asChild size="sm" className="flex-1 rounded-xl">
            <a href={playlist.spotify_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Open in Spotify
            </a>
          </Button>
          {embedUrl && (
            <Button
              size="sm"
              variant="secondary"
              className="rounded-xl shrink-0"
              onClick={() => setShowPreview((s) => !s)}
              aria-label={showPreview ? "Hide preview" : "Show preview"}
            >
              {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
        </div>

        {showPreview && embedUrl && (
          <iframe
            title={`${playlist.title} preview`}
            src={embedUrl}
            width="100%"
            height={152}
            frameBorder={0}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="rounded-xl border-0 w-full mt-1"
          />
        )}
      </div>
    </Card>
  );
}
