import { useState } from "react";
import { ArrowLeft, Play, Swords } from "lucide-react";
import { GAMES, gameByKey, type GameDef, type GameMode } from "@/lib/games";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import GameLeaderboard from "@/components/GameLeaderboard";

import MemoryMatch from "@/components/games/MemoryMatch";
import NumberSlide from "@/components/games/NumberSlide";
import ReactionRush from "@/components/games/ReactionRush";
import WordScramble from "@/components/games/WordScramble";
import Tile2048 from "@/components/games/Tile2048";
import TicTacToe from "@/components/games/TicTacToe";
import WordLink from "@/components/games/WordLink";
import SketchRush from "@/components/games/SketchRush";
import Imposter from "@/components/games/Imposter";

function renderGame(def: GameDef) {
  switch (def.key) {
    case "memory-match":
      return <MemoryMatch />;
    case "number-slide":
      return <NumberSlide />;
    case "reaction-rush":
      return <ReactionRush />;
    case "word-scramble":
      return <WordScramble />;
    case "2048":
      return <Tile2048 />;
    case "tic-tac-toe":
      return <TicTacToe gameId={def.gameId} />;
    case "word-link":
      return <WordLink gameId={def.gameId} />;
    case "sketch-rush":
      return <SketchRush gameId={def.gameId} />;
    case "imposter":
      return <Imposter gameId={def.gameId} />;
    default:
      return null;
  }
}

export default function ChillGames() {
  const [mode, setMode] = useState<GameMode>("solo");
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const active = activeKey ? gameByKey(activeKey) : null;
  const visible = GAMES.filter((g) => g.mode === mode);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Games</h2>
        <p className="text-sm text-muted-foreground mt-1">Take a break — solo puzzles & head-to-head matches.</p>
      </div>

      {active ? (
        <div className="space-y-5">
          <button
            onClick={() => setActiveKey(null)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> All games
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
            <div className="rounded-2xl border border-border/30 bg-card/60 overflow-hidden">
              <div className={`bg-gradient-to-br ${active.accent} px-5 py-4 flex items-center gap-3`}>
                <div className="w-11 h-11 rounded-xl bg-background/25 flex items-center justify-center shrink-0">
                  <active.icon className={`w-6 h-6 ${active.iconColor}`} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">{active.title}</h3>
                  <p className="text-xs text-muted-foreground">{active.blurb}</p>
                </div>
              </div>
              <div className="p-5">{renderGame(active)}</div>
            </div>

            <GameLeaderboard gameKey={active.key} />
          </div>
        </div>
      ) : (
        <>
          <Tabs value={mode} onValueChange={(v) => setMode(v as GameMode)}>
            <TabsList className="bg-card/60 border border-border/30">
              <TabsTrigger value="solo">Solo</TabsTrigger>
              <TabsTrigger value="multiplayer">Multiplayer</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((g) => (
              <div
                key={g.key}
                className="rounded-2xl border border-border/30 bg-card/60 overflow-hidden flex flex-col transition-all hover:border-border/60 hover:-translate-y-0.5"
              >
                <div className={`relative h-32 bg-gradient-to-br ${g.accent} flex items-center justify-center`}>
                  <g.icon className={`w-14 h-14 ${g.iconColor}`} strokeWidth={1.5} />
                  <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wide text-foreground/60 bg-background/30 px-2 py-0.5 rounded-full">
                    {g.mode === "solo" ? "Solo" : "1v1"}
                  </span>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-display font-semibold text-foreground">{g.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 flex-1">{g.blurb}</p>
                  <Button className="mt-4 w-full" onClick={() => setActiveKey(g.key)}>
                    {g.mode === "solo" ? (
                      <><Play className="w-4 h-4" /> Play</>
                    ) : (
                      <><Swords className="w-4 h-4" /> Challenge</>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
