import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GraduationCap, ArrowRightLeft, Trophy, MessageCircle } from "lucide-react";

const LEARN_TILES = [
  {
    path: "/learn/courses",
    icon: GraduationCap,
    title: "Mini-Courses",
    description: "Bite-sized learning for the team",
    color: "from-teal-500/10 to-cyan-500/5",
    iconColor: "text-teal-400",
    accent: "bg-teal-500/10",
    stat: "3 courses",
  },
  {
    path: "/learn/skill-swap",
    icon: ArrowRightLeft,
    title: "Skill Swap Board",
    description: "Offer skills, find mentors",
    color: "from-blue-500/10 to-indigo-500/5",
    iconColor: "text-blue-400",
    accent: "bg-blue-500/10",
    stat: "4 swaps",
  },
  {
    path: "/learn/leaderboard",
    icon: Trophy,
    title: "Brain Teaser Leaderboard",
    description: "Daily puzzles & rankings",
    color: "from-amber-500/10 to-yellow-500/5",
    iconColor: "text-amber-400",
    accent: "bg-amber-500/10",
    stat: "Today's live",
  },
  {
    path: "/learn/ama",
    icon: MessageCircle,
    title: "AMA Archive",
    description: "Ask Me Anything sessions",
    color: "from-purple-500/10 to-pink-500/5",
    iconColor: "text-purple-400",
    accent: "bg-purple-500/10",
    stat: "1 active",
  },
];

export default function Learn() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Learning Lounge</h2>
        <p className="text-sm text-muted-foreground mt-1">Grow your skills, share knowledge, and challenge yourself.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {LEARN_TILES.map((tile) => (
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
