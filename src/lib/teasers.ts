// Pure helpers for the Brain Teaser leaderboard: dates, streaks, weekly winners.

export interface TeaserToday {
  id: string;
  date: string;
  prompt: string;
  solved: boolean;
  solve_seconds: number | null;
}

export interface EntryUser {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

export interface EntryRow {
  id: string;
  teaser_id: string;
  user_id: string;
  solve_seconds: number;
  teaser_date: string | null;
  solved_at: string;
  user?: EntryUser | null;
}

export interface WeeklyStanding {
  userId: string;
  name: string | null;
  avatar_url: string | null;
  solves: number;
  totalSeconds: number;
}

// ── Date utilities (local time, YYYY-MM-DD) ─────────────────
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return fmt(d);
}
export function todayStr(): string {
  return fmt(new Date());
}
/** Monday of the week containing `today`. */
export function weekStartStr(today: string): string {
  const d = parseDate(today);
  const dow = (d.getDay() + 6) % 7; // Mon = 0 … Sun = 6
  d.setDate(d.getDate() - dow);
  return fmt(d);
}

/**
 * Consecutive-day solve streak ending at today (forgiving: if today isn't
 * solved yet, it counts back from yesterday so the streak isn't lost mid-day).
 */
export function computeStreak(dates: Set<string>, today: string): number {
  let cursor = dates.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Per-user streaks from a flat list of entries. */
export function streaksByUser(entries: EntryRow[], today: string): Map<string, number> {
  const byUser = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!e.teaser_date) continue;
    if (!byUser.has(e.user_id)) byUser.set(e.user_id, new Set());
    byUser.get(e.user_id)!.add(e.teaser_date);
  }
  const out = new Map<string, number>();
  for (const [uid, set] of byUser) out.set(uid, computeStreak(set, today));
  return out;
}

/** This week's standings, most solves first (ties broken by faster total time). */
export function weeklyStandings(entries: EntryRow[], today: string): WeeklyStanding[] {
  const start = weekStartStr(today);
  const map = new Map<string, WeeklyStanding>();
  for (const e of entries) {
    if (!e.teaser_date || e.teaser_date < start || e.teaser_date > today) continue;
    const cur =
      map.get(e.user_id) ??
      { userId: e.user_id, name: e.user?.name ?? null, avatar_url: e.user?.avatar_url ?? null, solves: 0, totalSeconds: 0 };
    cur.solves += 1;
    cur.totalSeconds += e.solve_seconds;
    map.set(e.user_id, cur);
  }
  return [...map.values()].sort((a, b) => b.solves - a.solves || a.totalSeconds - b.totalSeconds);
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
