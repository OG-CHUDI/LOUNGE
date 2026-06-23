import { useEffect, useMemo } from "react";
import { Mic, Square, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import AudioPlayer from "./AudioPlayer";
import type { AudioRecorder } from "@/hooks/useAudioRecorder";

const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

/** Record / stop / preview controls wired to a useAudioRecorder instance. */
export default function RecorderControls({
  recorder,
  maxSeconds = 120,
  label = "Record",
}: {
  recorder: AudioRecorder;
  maxSeconds?: number;
  label?: string;
}) {
  const url = useMemo(() => (recorder.blob ? URL.createObjectURL(recorder.blob) : null), [recorder.blob]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  if (recorder.recording) {
    return (
      <div className="flex items-center gap-3">
        <Button onClick={recorder.stop} variant="destructive" className="rounded-xl gap-2">
          <Square className="w-4 h-4" /> Stop
        </Button>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="tabular-nums">{fmt(recorder.seconds)} / {fmt(maxSeconds)}</span>
        </span>
      </div>
    );
  }

  if (url) {
    return (
      <div className="space-y-2">
        <AudioPlayer src={url} durationSeconds={recorder.seconds} />
        <Button onClick={() => void recorder.start()} variant="outline" size="sm" className="rounded-xl gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Re-record
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Button onClick={() => void recorder.start()} variant="outline" className="rounded-xl gap-2">
        <Mic className="w-4 h-4" /> {label}
      </Button>
      {recorder.error && <p className="text-xs text-destructive">{recorder.error}</p>}
    </div>
  );
}
