// Central game registry. Both the Games page and the leaderboard read from
// here so a new game only needs one entry.
//
// Scoring convention: a higher `score` is ALWAYS better. Time/move based
// games store a normalised score (see the helpers below); multiplayer games
// store 1 per win and the leaderboard sums them into total wins.

import type { LucideIcon } from "lucide-react";
import { LayoutGrid, Grid2x2, Zap, Type, Link2, Pencil, Hash, Boxes, VenetianMask } from "lucide-react";

export type GameMode = "solo" | "multiplayer";
export type LeaderboardAggregate = "best" | "sum";

export interface GameDef {
  key: string;
  gameId: string; // uuid in the `games` table (for multiplayer matchmaking)
  title: string;
  mode: GameMode;
  icon: LucideIcon;
  blurb: string;
  accent: string; // tailwind gradient for the cover
  iconColor: string;
  metricLabel: string; // leaderboard column header
  aggregate: LeaderboardAggregate;
  formatScore: (score: number) => string; // turn stored score → human label
}

// ── Normalisers (keep "higher is better") ──────────────────────────────
export const movesTimeScore = (moves: number, seconds: number, base = 10000, mw = 100, tw = 10) =>
  Math.max(0, Math.round(base - moves * mw - seconds * tw));

export const GAMES: GameDef[] = [
  {
    key: "memory-match",
    gameId: "a0000000-0000-0000-0000-000000000001",
    title: "Memory Match",
    mode: "solo",
    icon: LayoutGrid,
    blurb: "Flip and pair the tiles in as few moves as you can.",
    accent: "from-amber-500/25 to-orange-500/10",
    iconColor: "text-amber-300",
    metricLabel: "Score",
    aggregate: "best",
    formatScore: (s) => `${s.toLocaleString()} pts`,
  },
  {
    key: "number-slide",
    gameId: "a0000000-0000-0000-0000-000000000002",
    title: "Number Slide",
    mode: "solo",
    icon: Grid2x2,
    blurb: "Slide the tiles back into order. The classic 15-puzzle.",
    accent: "from-sky-500/25 to-blue-500/10",
    iconColor: "text-sky-300",
    metricLabel: "Score",
    aggregate: "best",
    formatScore: (s) => `${s.toLocaleString()} pts`,
  },
  {
    key: "reaction-rush",
    gameId: "a0000000-0000-0000-0000-000000000004",
    title: "Reaction Rush",
    mode: "solo",
    icon: Zap,
    blurb: "Tap the moment it turns green. Test your reflexes over 5 rounds.",
    accent: "from-yellow-500/25 to-lime-500/10",
    iconColor: "text-lime-300",
    metricLabel: "Avg reaction",
    aggregate: "best",
    formatScore: (s) => `${Math.max(0, 1000 - s)}ms`, // stored as 1000-ms
  },
  {
    key: "2048",
    gameId: "a0000000-0000-0000-0000-000000000009",
    title: "2048",
    mode: "solo",
    icon: Boxes,
    blurb: "Slide and merge tiles to reach 2048 — and rack up the highest score.",
    accent: "from-orange-500/25 to-amber-500/10",
    iconColor: "text-orange-300",
    metricLabel: "Best score",
    aggregate: "best",
    formatScore: (s) => `${s.toLocaleString()} pts`,
  },
  {
    key: "word-scramble",
    gameId: "a0000000-0000-0000-0000-000000000005",
    title: "Word Scramble",
    mode: "solo",
    icon: Type,
    blurb: "Unscramble as many words as you can before the clock runs out.",
    accent: "from-fuchsia-500/25 to-purple-500/10",
    iconColor: "text-fuchsia-300",
    metricLabel: "Words",
    aggregate: "best",
    formatScore: (s) => `${s} words`,
  },
  {
    key: "word-link",
    gameId: "a0000000-0000-0000-0000-000000000006",
    title: "Word Link",
    mode: "multiplayer",
    icon: Link2,
    blurb: "Take turns chaining words — each must start with the last letter.",
    accent: "from-teal-500/25 to-cyan-500/10",
    iconColor: "text-teal-300",
    metricLabel: "Wins",
    aggregate: "sum",
    formatScore: (s) => `${s} ${s === 1 ? "win" : "wins"}`,
  },
  {
    key: "sketch-rush",
    gameId: "a0000000-0000-0000-0000-000000000007",
    title: "Sketch Rush",
    mode: "multiplayer",
    icon: Pencil,
    blurb: "One draws, the rest guess. First correct guess takes the round.",
    accent: "from-rose-500/25 to-pink-500/10",
    iconColor: "text-rose-300",
    metricLabel: "Wins",
    aggregate: "sum",
    formatScore: (s) => `${s} ${s === 1 ? "win" : "wins"}`,
  },
  {
    key: "imposter",
    gameId: "a0000000-0000-0000-0000-00000000000a",
    title: "Imposter",
    mode: "multiplayer",
    icon: VenetianMask,
    blurb: "3+ players. Everyone gets the secret word — except the imposter. Give clues, then vote them out.",
    accent: "from-violet-500/25 to-fuchsia-500/10",
    iconColor: "text-violet-300",
    metricLabel: "Wins",
    aggregate: "sum",
    formatScore: (s) => `${s} ${s === 1 ? "win" : "wins"}`,
  },
  {
    key: "tic-tac-toe",
    gameId: "a0000000-0000-0000-0000-000000000008",
    title: "Tic-Tac-Toe",
    mode: "multiplayer",
    icon: Hash,
    blurb: "The timeless duel. Three in a row to win.",
    accent: "from-indigo-500/25 to-violet-500/10",
    iconColor: "text-indigo-300",
    metricLabel: "Wins",
    aggregate: "sum",
    formatScore: (s) => `${s} ${s === 1 ? "win" : "wins"}`,
  },
];

export const gameByKey = (key: string) => GAMES.find((g) => g.key === key);
