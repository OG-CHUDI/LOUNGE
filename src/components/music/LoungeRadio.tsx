import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radio, Play, Pause, SkipBack, SkipForward, Volume2, Music } from "lucide-react";
import { RADIO_ATTRIBUTION, type RadioKey } from "./radio-tracks";
import { useMusic } from "./MusicProvider";

const fmt = (s: number) =>
  isFinite(s) ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}` : "0:00";

/**
 * Full radio UI on the Music page. All playback state lives in MusicProvider so
 * audio keeps going when you navigate away (see MiniPlayer).
 */
export default function LoungeRadio() {
  const {
    stations, stationKey, station, index, track, playing,
    progress, duration, volume, toggle, next, prev, selectTrack, switchStation, seek, setVolume,
  } = useMusic();

  return (
    <Card className="p-5 bg-card/60 border-border/30 rounded-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <Radio className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground leading-tight">Lounge Radio</h3>
            <p className="text-xs text-muted-foreground">Full tracks, royalty-free. Keeps playing as you browse.</p>
          </div>
        </div>

        <Tabs value={stationKey} onValueChange={(v) => switchStation(v as RadioKey)}>
          <TabsList className="bg-muted/40 rounded-xl">
            {stations.map((s) => (
              <TabsTrigger key={s.key} value={s.key} className="rounded-lg text-xs">
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Now playing + transport */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-accent/5 border border-border/30 p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-background/40 flex items-center justify-center shrink-0">
            <Music className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{track.title}</p>
            <p className="text-xs text-muted-foreground">{station.label} · Lounge Radio</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground tabular-nums">
          <span>{fmt(progress)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={progress}
            onChange={(e) => seek(Number(e.target.value))}
            className="flex-1 h-1 accent-primary cursor-pointer"
          />
          <span>{fmt(duration)}</span>
        </div>

        <div className="flex items-center justify-center gap-4 mt-3">
          <button onClick={prev} className="text-muted-foreground hover:text-foreground transition-colors" title="Previous">
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={toggle}
            className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:brightness-110 transition"
            title={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button onClick={next} className="text-muted-foreground hover:text-foreground transition-colors" title="Next">
            <SkipForward className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5 ml-2">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-16 h-1 accent-primary cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Track list */}
      <div className="mt-3 space-y-0.5 max-h-44 overflow-y-auto scrollbar-thin">
        {station.tracks.map((tr, i) => {
          const active = i === index;
          return (
            <button
              key={tr.url}
              onClick={() => selectTrack(i)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-sm transition-colors ${
                active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/10"
              }`}
            >
              <span className="w-5 text-center text-xs">
                {active && playing ? <Pause className="w-3.5 h-3.5 inline text-primary" /> : i + 1}
              </span>
              <span className="truncate flex-1">{tr.title}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">Music: {RADIO_ATTRIBUTION}</p>
    </Card>
  );
}
