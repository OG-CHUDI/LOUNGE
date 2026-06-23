import { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

/** Compact custom audio player (recorded webm can report Infinity duration,
 * so we fall back to the stored duration for the total label). */
export default function AudioPlayer({
  src,
  durationSeconds,
  onPlay,
}: {
  src: string;
  durationSeconds?: number | null;
  onPlay?: () => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState<number | null>(null);

  const total =
    loaded && Number.isFinite(loaded) ? loaded : durationSeconds && durationSeconds > 0 ? durationSeconds : 0;
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      void el.play();
      onPlay?.();
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/15 border border-border/30 px-3 py-2">
      <button
        type="button"
        onClick={toggle}
        className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0 hover:bg-primary/25 transition-colors"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
          <div className="h-full bg-primary/70 transition-[width] duration-150" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
        {fmt(playing || current > 0 ? current : total)}
      </span>

      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          setLoaded(Number.isFinite(d) ? d : null);
        }}
        className="hidden"
      />
    </div>
  );
}
