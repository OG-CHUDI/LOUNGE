import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Coffee, Gamepad2, Music, Palette, PawPrint, Image, Flame } from "lucide-react";

const CHILL_TILES = [
  {
    path: "/chill/games",
    icon: Gamepad2,
    title: "Games",
    description: "Solo puzzles & head-to-head matches",
    color: "from-amber-500/10 to-orange-500/5",
    iconColor: "text-amber-400",
    accent: "bg-amber-500/10",
    stat: "3 active",
  },
  {
    path: "/chill/music",
    icon: Music,
    title: "Music",
    description: "Team playlists & what's playing now",
    color: "from-pink-500/10 to-rose-500/5",
    iconColor: "text-pink-400",
    accent: "bg-pink-500/10",
    stat: "2 playlists",
  },
  {
    path: "/chill/canvas",
    icon: Palette,
    title: "Collaborative Canvas",
    description: "Draw together in real-time",
    color: "from-purple-500/10 to-violet-500/5",
    iconColor: "text-purple-400",
    accent: "bg-purple-500/10",
    stat: "1 board",
  },
  {
    path: "/chill/pets",
    icon: PawPrint,
    title: "Desk Pets",
    description: "Grow, feed & dress up your companion",
    color: "from-emerald-500/10 to-green-500/5",
    iconColor: "text-emerald-400",
    accent: "bg-emerald-500/10",
    stat: "Adopt yours",
  },
  {
    path: "/chill/memes",
    icon: Image,
    title: "Meme Wall",
    description: "The team pinboard of joy",
    color: "from-cyan-500/10 to-blue-500/5",
    iconColor: "text-cyan-400",
    accent: "bg-cyan-500/10",
    stat: "3 memes",
  },
  {
    path: "/chill/hot-takes",
    icon: Flame,
    title: "Hot Takes",
    description: "Spicy opinions, voted on by the team",
    color: "from-orange-500/10 to-red-500/5",
    iconColor: "text-orange-400",
    accent: "bg-orange-500/10",
    stat: "Agree or disagree",
  },
];

export default function Chill() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Chill Lounge</h2>
        <p className="text-sm text-muted-foreground mt-1">Unwind, play, and connect with the team.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CHILL_TILES.map((tile) => (
          <button
            key={tile.path}
            onClick={() => navigate(tile.path)}
            className="group text-left"
          >
            <Card
              className={cn(
                "relative overflow-hidden p-6 h-full border-border/30 bg-card/60 backdrop-blur-sm",
                "shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/20",
                "hover:-translate-y-1 transition-all duration-300"
              )}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br", tile.color, "opacity-0 group-hover:opacity-100 transition-opacity duration-300")} />
              <div className="relative z-10">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", tile.accent)}>
                  <tile.icon className={cn("w-6 h-6", tile.iconColor)} strokeWidth={1.5} />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-1">{tile.title}</h3>
                <p className="text-xs text-muted-foreground mb-3">{tile.description}</p>
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
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
