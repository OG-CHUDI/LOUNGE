import { useLocation, useNavigate } from "react-router-dom";
import { Play, Pause, SkipForward, X, Music } from "lucide-react";
import { useMusic } from "./MusicProvider";

/**
 * Compact always-on music control shown on every page except the Music page.
 * Lets you pause/resume, skip, stop, or jump back to the full radio.
 */
export default function MiniPlayer() {
  const { hasTrack, playing, track, station, toggle, next, stop } = useMusic();
  const location = useLocation();
  const navigate = useNavigate();

  if (!hasTrack || location.pathname === "/chill/music") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl shadow-xl shadow-black/30 pl-3 pr-2 py-2 animate-fade-in">
      <button
        onClick={() => navigate("/chill/music")}
        className="flex items-center gap-2.5 min-w-0 max-w-[200px] text-left"
        title="Open Lounge Radio"
      >
        <span className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Music className="w-4 h-4 text-primary" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-medium text-foreground truncate">{track.title}</span>
          <span className="block text-[10px] text-muted-foreground truncate">{station.label} · Lounge Radio</span>
        </span>
      </button>

      <div className="flex items-center gap-0.5 pl-1 border-l border-border/30">
        <button onClick={toggle} className="p-2 rounded-lg hover:bg-muted/20 text-foreground transition-colors" title={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button onClick={next} className="p-2 rounded-lg hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors" title="Next track">
          <SkipForward className="w-4 h-4" />
        </button>
        <button onClick={stop} className="p-2 rounded-lg hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors" title="Stop">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
