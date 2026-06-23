import { Lock, Check } from "lucide-react";
import { TOTAL_LEVELS } from "@/lib/levels";

interface LevelBarProps {
  /** Currently selected level (1-based). */
  level: number;
  /** Highest unlocked level. Levels above this are locked. */
  unlocked: number;
  /** A short label for the difficulty of the current level (e.g. "5×5 grid"). */
  hint?: string;
  onSelect: (level: number) => void;
}

/** Horizontal 1..20 level picker shared by every solo game. */
export default function LevelBar({ level, unlocked, hint, onSelect }: LevelBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Level <span className="text-foreground font-semibold">{level}</span> / {TOTAL_LEVELS}
        </span>
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map((n) => {
          const locked = n > unlocked;
          const done = n < unlocked;
          const active = n === level;
          return (
            <button
              key={n}
              disabled={locked}
              onClick={() => onSelect(n)}
              title={locked ? "Clear the level before to unlock" : `Level ${n}`}
              className={`relative w-8 h-8 shrink-0 rounded-lg text-xs font-semibold tabular-nums flex items-center justify-center transition-all ${
                active
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
                  : locked
                    ? "bg-muted/10 text-muted-foreground/40 cursor-not-allowed"
                    : done
                      ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                      : "bg-card/80 border border-border/30 text-foreground hover:bg-card"
              }`}
            >
              {locked ? <Lock className="w-3 h-3" /> : done && !active ? <Check className="w-3 h-3" /> : n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
