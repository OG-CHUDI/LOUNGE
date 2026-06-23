import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioRecorder {
  recording: boolean;
  blob: Blob | null;
  seconds: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

/**
 * Record audio in the browser via MediaRecorder. Auto-stops at `maxSeconds`.
 * The recorded Blob can be uploaded straight to Supabase Storage.
 */
export function useAudioRecorder(maxSeconds = 120): AudioRecorder {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stop = useCallback(() => {
    clearTimer();
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        setBlob(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        const s = Math.floor((Date.now() - startedAt) / 1000);
        setSeconds(s);
        if (s >= maxSeconds) stop();
      }, 250);
    } catch {
      setError("Couldn't access your microphone. Check the browser permission.");
      setRecording(false);
    }
  }, [maxSeconds, stop]);

  const reset = useCallback(() => {
    setBlob(null);
    setSeconds(0);
    setError(null);
  }, []);

  // Tidy up on unmount.
  useEffect(
    () => () => {
      clearTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    []
  );

  return { recording, blob, seconds, error, start, stop, reset };
}
