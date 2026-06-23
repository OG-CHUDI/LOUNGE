import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Mic, AudioLines, BadgeCheck, Headphones, Podcast } from "lucide-react";

interface Tile {
  path?: string;
  icon: typeof Mic;
  title: string;
  description: string;
  color: string;
  iconColor: string;
  accent: string;
  stat: string;
  soon?: boolean;
}

const TILES: Tile[] = [
  {
    path: "/airwaves/voice-notes",
    icon: Mic,
    title: "Voice Notes",
    description: "Quick spoken updates the team can react to",
    color: "from-indigo-500/10 to-violet-500/5",
    iconColor: "text-indigo-400",
    accent: "bg-indigo-500/10",
    stat: "Record & reply",
  },
  {
    path: "/airwaves/soundboard",
    icon: AudioLines,
    title: "Soundboard",
    description: "Stingers, catchphrases & in-jokes",
    color: "from-fuchsia-500/10 to-pink-500/5",
    iconColor: "text-fuchsia-400",
    accent: "bg-fuchsia-500/10",
    stat: "Tap to play",
  },
  {
    path: "/airwaves/name-tags",
    icon: BadgeCheck,
    title: "Name Tags",
    description: "How to say everyone's name",
    color: "from-teal-500/10 to-emerald-500/5",
    iconColor: "text-teal-400",
    accent: "bg-teal-500/10",
    stat: "Say it right",
  },
  {
    icon: Headphones,
    title: "Drop-in Rooms",
    description: "Live voice rooms — hop in and chat",
    color: "from-amber-500/10 to-orange-500/5",
    iconColor: "text-amber-400",
    accent: "bg-amber-500/10",
    stat: "Coming soon",
    soon: true,
  },
  {
    icon: Podcast,
    title: "The Pod",
    description: "The team's episodic audio",
    color: "from-rose-500/10 to-red-500/5",
    iconColor: "text-rose-400",
    accent: "bg-rose-500/10",
    stat: "Coming soon",
    soon: true,
  },
];

export default function Airwaves() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Airwaves Lounge</h2>
        <p className="text-sm text-muted-foreground mt-1">The team's spoken-audio space — talk, listen, react.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((tile) => (
          <button
            key={tile.title}
            onClick={() => tile.path && navigate(tile.path)}
            disabled={tile.soon}
            className={cn("group text-left", tile.soon && "cursor-default")}
          >
            <Card
              className={cn(
                "relative overflow-hidden p-6 h-full border-border/30 bg-card/60 backdrop-blur-sm",
                "shadow-lg shadow-black/10 transition-all duration-300",
                tile.soon ? "opacity-60" : "hover:shadow-xl hover:shadow-black/20 hover:-translate-y-1"
              )}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br", tile.color, "opacity-0 group-hover:opacity-100 transition-opacity duration-300", tile.soon && "group-hover:opacity-0")} />
              <div className="relative z-10">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", tile.accent)}>
                  <tile.icon className={cn("w-6 h-6", tile.iconColor)} strokeWidth={1.5} />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-1">{tile.title}</h3>
                <p className="text-xs text-muted-foreground mb-3">{tile.description}</p>
                <span
                  className={cn(
                    "text-[10px] font-medium px-2 py-0.5 rounded-full",
                    tile.soon ? "text-muted-foreground bg-muted/20" : "text-primary bg-primary/10"
                  )}
                >
                  {tile.stat}
                </span>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
