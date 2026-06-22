import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { RADIO_STATIONS, stationByKey, type RadioKey, type RadioStation, type RadioTrack } from "./radio-tracks";

interface MusicValue {
  stations: RadioStation[];
  stationKey: RadioKey;
  station: RadioStation;
  index: number;
  track: RadioTrack;
  playing: boolean;
  hasTrack: boolean;
  progress: number;
  duration: number;
  volume: number;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  selectTrack: (i: number) => void;
  switchStation: (key: RadioKey) => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
}

const MusicContext = createContext<MusicValue | null>(null);

/**
 * App-wide music player. Mounted above the router so the single <audio> element
 * keeps playing across page navigations. The Music page and the global
 * MiniPlayer are both just views over this state.
 */
export function MusicProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [stationKey, setStationKey] = useState<RadioKey>("jazz");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hasTrack, setHasTrack] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);

  const station = stationByKey(stationKey);
  const tracks = station.tracks;
  const track = tracks[index] ?? tracks[0];

  const setListening = (title: string | null) => {
    if (!user) return;
    void supabase
      .from("listening_now")
      .upsert(
        { user_id: user.id, track_title: title, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
  };

  // Load the chosen track; (auto)play if we're in a playing state.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.src = track.url;
    a.load();
    if (playing) {
      a.play()
        .then(() => setListening(`${track.title} · Lounge Radio`))
        .catch(() => setPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.url]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const play = () => {
    setHasTrack(true);
    setPlaying(true);
    audioRef.current
      ?.play()
      .then(() => setListening(`${track.title} · Lounge Radio`))
      .catch(() => setPlaying(false));
  };
  const pause = () => {
    audioRef.current?.pause();
    setPlaying(false);
    setListening(null);
  };
  const toggle = () => (playing ? pause() : play());
  const stop = () => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setPlaying(false);
    setHasTrack(false);
    setProgress(0);
    setListening(null);
  };
  const selectTrack = (i: number) => {
    setIndex(i);
    setHasTrack(true);
    setPlaying(true);
  };
  const next = () => selectTrack((index + 1) % tracks.length);
  const prev = () => selectTrack((index - 1 + tracks.length) % tracks.length);
  const switchStation = (key: RadioKey) => {
    setStationKey(key);
    setIndex(0);
  };
  const seek = (t: number) => {
    if (audioRef.current) audioRef.current.currentTime = t;
    setProgress(t);
  };
  const setVolume = (v: number) => setVolumeState(v);

  const value: MusicValue = {
    stations: RADIO_STATIONS,
    stationKey,
    station,
    index,
    track,
    playing,
    hasTrack,
    progress,
    duration,
    volume,
    toggle,
    play,
    pause,
    stop,
    next,
    prev,
    selectTrack,
    switchStation,
    seek,
    setVolume,
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={next}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
    </MusicContext.Provider>
  );
}

export function useMusic(): MusicValue {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used within a MusicProvider");
  return ctx;
}
