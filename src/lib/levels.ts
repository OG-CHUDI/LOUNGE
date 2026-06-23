// Per-game level progression for the solo games.
//
// Each solo game has 20 levels of increasing difficulty. We persist only the
// highest UNLOCKED level per game in localStorage (per device) — leaderboard
// scores still go to Supabase as before, now tagged with the level in `detail`.

export const TOTAL_LEVELS = 20;

const storageKey = (game: string) => `lounge:levels:${game}`;

/** Highest level the player has unlocked for a game (>= 1, <= TOTAL_LEVELS). */
export function getUnlockedLevel(game: string): number {
  try {
    const raw = localStorage.getItem(storageKey(game));
    const n = raw ? parseInt(raw, 10) : 1;
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(n, TOTAL_LEVELS);
  } catch {
    return 1;
  }
}

/**
 * Record that `completedLevel` was cleared and unlock the next one.
 * Returns the new highest-unlocked level. Never moves backwards.
 */
export function unlockNextLevel(game: string, completedLevel: number): number {
  const current = getUnlockedLevel(game);
  const next = Math.min(TOTAL_LEVELS, Math.max(current, completedLevel + 1));
  try {
    localStorage.setItem(storageKey(game), String(next));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  return next;
}

/** Linear interpolation helper for difficulty curves (level 1..20). */
export function lerpByLevel(level: number, atLevel1: number, atLevel20: number): number {
  const t = (Math.min(TOTAL_LEVELS, Math.max(1, level)) - 1) / (TOTAL_LEVELS - 1);
  return atLevel1 + (atLevel20 - atLevel1) * t;
}
