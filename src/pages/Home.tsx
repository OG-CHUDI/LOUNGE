import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import PetAvatar from "@/components/PetAvatar";
import { stageIndex, STAGE_LABELS, type Accessories } from "@/lib/pets";
import {
  Coffee,
  GraduationCap,
  Target,
  Trophy,
  Music,
  Gamepad2,
  Palette,
  PawPrint,
  Image,
  Clock,
  Zap,
  ArrowRight,
  Flame,
  Star,
  MessageCircle,
  Sparkles,
} from "lucide-react";

const LOUNGE_CARDS = [
  {
    path: "/chill",
    icon: Coffee,
    title: "Chill Lounge",
    subtitle: "Games, Music, Canvas, Pets & Memes",
    color: "from-amber-500/20 to-rose-500/10",
    iconColor: "text-amber-400",
    accent: "bg-amber-500/20",
  },
  {
    path: "/learn",
    icon: GraduationCap,
    title: "Learning Lounge",
    subtitle: "Courses, Skill Swaps, Teasers & AMAs",
    color: "from-teal-500/20 to-cyan-500/10",
    iconColor: "text-teal-400",
    accent: "bg-teal-500/20",
  },
  {
    path: "/focus",
    icon: Target,
    title: "Focus Lounge",
    subtitle: "Group Pomodoro & Deep Work",
    color: "from-indigo-500/15 to-blue-500/10",
    iconColor: "text-indigo-400",
    accent: "bg-indigo-500/20",
  },
];

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

const STAGE_THRESHOLDS = [0, 20, 80, 200];

function growthProgress(xp: number): number {
  const s = stageIndex(xp);
  if (s >= 3) return 100;
  const prev = STAGE_THRESHOLDS[s];
  const next = STAGE_THRESHOLDS[s + 1];
  return Math.min(100, Math.round(((xp - prev) / (next - prev)) * 100));
}

export default function Home() {
  const { profile, deskPet } = useAuth();
  const navigate = useNavigate();

  const { data: activeAma } = useQuery({
    queryKey: ["active-ama"],
    queryFn: async () => {
      const { data } = await supabase
        .from("amas")
        .select("*, spotlight_user:profiles!amas_spotlight_user_id_fkey(id, name, role, avatar_url)")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    staleTime: 60_000,
  });

  const { data: latestMeme } = useQuery({
    queryKey: ["latest-meme"],
    queryFn: async () => {
      const { data } = await supabase
        .from("memes")
        .select("*, poster:profiles!memes_poster_id_fkey(name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    staleTime: 60_000,
  });

  const { data: nowListening } = useQuery({
    queryKey: ["now-listening"],
    queryFn: async () => {
      const { data } = await supabase
        .from("listening_now")
        .select("*, user:profiles!listening_now_user_id_fkey(name, avatar_url)")
        .order("updated_at", { ascending: false })
        .limit(5);
      return data;
    },
    refetchInterval: 30_000,
  });

  const { data: onlineCount } = useQuery({
    queryKey: ["online-focus"],
    queryFn: async () => {
      const { count } = await supabase
        .from("focus_status")
        .select("*", { count: "exact", head: true })
        .eq("is_focusing", true);
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const { data: courseCount } = useQuery({
    queryKey: ["course-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("courses")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
    staleTime: 300_000,
  });

  const petXp = deskPet?.xp ?? 0;
  const petStage = stageIndex(petXp);
  const xpProgress = growthProgress(petXp);
  const isAdopted = !!deskPet?.pet_name;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Greeting + Pet Hero */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold text-foreground mb-1">
            {getGreeting(profile?.name?.split(" ")[0] ?? "friend")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Desk Pet Hero */}
        <button onClick={() => navigate("/chill/pets")} className="text-left lg:min-w-[340px] group">
          <Card className="flex items-center gap-5 p-5 bg-card/60 backdrop-blur-sm border-border/30 shadow-lg shadow-black/10 transition-all group-hover:-translate-y-0.5 group-hover:shadow-xl group-hover:shadow-black/20">
            <div className="relative w-20 h-20 shrink-0">
              {/* Growth ring */}
              <svg className="absolute inset-0 w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" className="text-muted/15" strokeWidth="4" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="none"
                  stroke="currentColor"
                  className="text-primary"
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - xpProgress / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <PetAvatar
                  species={deskPet?.species ?? "chick"}
                  stage={petStage}
                  accessories={(deskPet?.accessories ?? {}) as Accessories}
                  size={56}
                />
              </div>
            </div>
            <div className="min-w-0">
              {isAdopted ? (
                <>
                  <p className="text-sm text-muted-foreground">Your Desk Pet</p>
                  <p className="font-display text-lg font-semibold text-foreground truncate">{deskPet?.pet_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{STAGE_LABELS[petStage]}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{deskPet?.streak ?? 0}</span> day streak
                    </span>
                  </div>
                  <Progress value={xpProgress} className="mt-2 h-1.5" />
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Your Desk Pet</p>
                  <p className="font-display text-lg font-semibold text-foreground">Adopt a companion</p>
                  <p className="text-xs text-primary mt-1 font-medium">Pick your pet →</p>
                </>
              )}
            </div>
          </Card>
        </button>
      </div>

      {/* Lounge Entry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {LOUNGE_CARDS.map((lounge) => (
          <button
            key={lounge.path}
            onClick={() => navigate(lounge.path)}
            className="group text-left"
          >
            <Card
              className={cn(
                "relative overflow-hidden p-6 h-full border-border/30 bg-card/60 backdrop-blur-sm",
                "shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/20",
                "hover:-translate-y-1 transition-all duration-300"
              )}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br", lounge.color, "opacity-0 group-hover:opacity-100 transition-opacity duration-300")} />
              <div className="relative z-10">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", lounge.accent)}>
                  <lounge.icon className={cn("w-5 h-5", lounge.iconColor)} strokeWidth={1.5} />
                </div>
                <h2 className="font-display text-lg font-semibold text-foreground mb-1">{lounge.title}</h2>
                <p className="text-xs text-muted-foreground mb-3">{lounge.subtitle}</p>

                {/* Live snippets */}
                <div className="space-y-2">
                  {lounge.path === "/chill" && (
                    <>
                      {nowListening && nowListening.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Music className="w-3 h-3 text-teal-400" />
                          <span>
                            {nowListening[0]?.track_title ?? "Nothing playing"} — {(nowListening[0] as any)?.user?.name?.split(" ")[0] ?? "Team"}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Gamepad2 className="w-3 h-3 text-amber-400" />
                        <span>Solo games & head-to-head matches</span>
                      </div>
                    </>
                  )}
                  {lounge.path === "/learn" && (
                    <>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <GraduationCap className="w-3 h-3 text-teal-400" />
                        <span>{courseCount} courses available</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Trophy className="w-3 h-3 text-amber-400" />
                        <span>Today's brain teaser is live</span>
                      </div>
                    </>
                  )}
                  {lounge.path === "/focus" && (
                    <>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Zap className="w-3 h-3 text-indigo-400" />
                        <span>{onlineCount} members in focus mode</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        <span>Start a group Pomodoro</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  Enter lounge <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </Card>
          </button>
        ))}
      </div>

      {/* Bottom row: AMA + Meme */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active AMA spotlight */}
        <Card className="p-5 bg-card/60 backdrop-blur-sm border-border/30 shadow-lg shadow-black/10">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <h3 className="font-display text-sm font-semibold text-foreground">AMA Spotlight</h3>
          </div>
          {activeAma && (activeAma as any)?.spotlight_user ? (
            <div className="flex items-center gap-4">
              <Avatar className="w-14 h-14 ring-2 ring-border/50">
                <AvatarImage src={(activeAma as any).spotlight_user.avatar_url} />
                <AvatarFallback className="bg-primary/20 text-primary text-lg font-semibold">
                  {((activeAma as any).spotlight_user.name ?? "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-foreground">{(activeAma as any).spotlight_user.name}</p>
                <p className="text-xs text-muted-foreground">{(activeAma as any).spotlight_user.role}</p>
                <p className="text-xs text-primary mt-1 font-medium">Ask them anything →</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active AMA right now. Check back soon!</p>
          )}
        </Card>

        {/* Latest meme pin */}
        <Card className="p-5 bg-card/60 backdrop-blur-sm border-border/30 shadow-lg shadow-black/10">
          <div className="flex items-center gap-2 mb-4">
            <Image className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <h3 className="font-display text-sm font-semibold text-foreground">Latest Meme Pin</h3>
          </div>
          {latestMeme ? (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted/20 flex-shrink-0">
                <img
                  src={(latestMeme as any).image_url}
                  alt="Latest meme"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Posted by {(latestMeme as any)?.poster?.name ?? "Team"}
                </p>
                <button
                  onClick={() => navigate("/chill/memes")}
                  className="text-xs text-primary font-medium mt-1 hover:underline"
                >
                  View meme wall →
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No memes yet. Be the first to pin one!</p>
          )}
        </Card>
      </div>
    </div>
  );
}
