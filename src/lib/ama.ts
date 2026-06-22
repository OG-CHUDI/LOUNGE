export type AmaMode = "fun" | "professional" | "both";
export type AmaStatus = "scheduled" | "live" | "ended";
export type MessageKind = "chat" | "question" | "answer" | "system";

export interface AmaPerson {
  id: string;
  name: string | null;
  role: string | null;
  avatar_url: string | null;
}

export interface AmaSession {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  mode: AmaMode;
  spotlight_ids: string[];
  invited_ids: string[];
  status: AmaStatus;
  scheduled_at: string | null;
  started_at: string | null;
  expires_at: string | null;
  duration_minutes: number;
  extensions: number;
  summary: string | null;
  course_id: string | null;
  created_at: string;
  host?: AmaPerson | null;
}

export interface AmaMessageRow {
  id: string;
  session_id: string;
  author_id: string | null;
  kind: MessageKind;
  body: string;
  reply_to: string | null;
  created_at: string;
  author?: AmaPerson | null;
}

export interface BankQuestion {
  id: string;
  mode: "fun" | "professional";
  prompt: string;
}

export const AMA_MODES: { value: AmaMode; label: string; hint: string }[] = [
  { value: "fun", label: "Fun", hint: "Get-to-know-you questions" },
  { value: "professional", label: "Professional", hint: "Expertise and craft" },
  { value: "both", label: "Both", hint: "A mix of the two" },
];

export const EXTEND_MINUTES = 15;

export function initials(name: string | null | undefined): string {
  return (name ?? "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function modeLabel(mode: AmaMode): string {
  return mode === "both" ? "Fun & Professional" : mode === "fun" ? "Fun" : "Professional";
}

/** mm:ss (or -mm:ss past expiry) remaining until `expiresAt`, given `nowMs`. */
export function remaining(expiresAt: string | null, nowMs: number): { text: string; expired: boolean } {
  if (!expiresAt) return { text: "", expired: false };
  const ms = new Date(expiresAt).getTime() - nowMs;
  const expired = ms <= 0;
  const abs = Math.abs(ms);
  const m = Math.floor(abs / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  return { text: `${expired ? "-" : ""}${m}:${String(s).padStart(2, "0")}`, expired };
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
