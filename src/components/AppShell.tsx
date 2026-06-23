import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Home,
  Coffee,
  GraduationCap,
  Target,
  Search,
  SunMoon,
  Lamp,
  Zap,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { stageIndex, STAGE_LABELS } from "@/lib/pets";
import MiniPlayer from "@/components/music/MiniPlayer";
import AnimatedBackground from "@/components/AnimatedBackground";
import NotificationBell from "@/components/NotificationBell";
import { BackgroundProvider } from "@/lib/background";
import { subscribeFocusAlerts } from "@/lib/focusAlerts";
import { toast } from "sonner";

const NAV_ITEMS = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/chill", icon: Coffee, label: "Chill Lounge", lounge: "chill" as const },
  { path: "/learn", icon: GraduationCap, label: "Learning Lounge", lounge: "learn" as const },
  { path: "/focus", icon: Target, label: "Focus Lounge", lounge: "focus" as const },
] as const;

const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/chill": "Chill Lounge",
  "/chill/games": "Games",
  "/chill/music": "Music",
  "/chill/canvas": "Collaborative Canvas",
  "/chill/pets": "Desk Pets",
  "/chill/memes": "Meme Wall",
  "/chill/hot-takes": "Hot Takes",
  "/learn": "Learning Lounge",
  "/learn/courses": "Mini-Courses",
  "/learn/stage": "The Stage",
  "/learn/skill-swap": "Skill Swap Board",
  "/learn/leaderboard": "Brain Teaser Leaderboard",
  "/learn/ama": "AMA Archive",
  "/focus": "Focus Lounge",
};

function getLoungeFromPath(pathname: string): string | null {
  if (pathname.startsWith("/chill")) return "chill";
  if (pathname.startsWith("/learn")) return "learn";
  if (pathname.startsWith("/focus")) return "focus";
  return null;
}

export default function AppShell() {
  const { user, profile, deskPet, isFocusing, toggleFocusMode, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showFocusBanner, setShowFocusBanner] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentLounge = getLoungeFromPath(location.pathname);
  const pageTitle = PAGE_TITLES[location.pathname] ?? "Lounge";

  // Apply lounge theme class
  useEffect(() => {
    document.documentElement.classList.remove("lounge-chill", "lounge-learn", "lounge-focus");
    if (currentLounge) {
      document.documentElement.classList.add(`lounge-${currentLounge}`);
    }
  }, [currentLounge]);

  // Apply light/dark theme
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  // Transient heads-up when a teammate opens a group focus session.
  useEffect(() => {
    if (!user) return;
    return subscribeFocusAlerts((alert) => {
      if (alert.hostId === user.id) return; // never alert the host about their own session
      toast(`${alert.hostName} started a group focus session`, {
        description: `${alert.durationMinutes}m · jump in to focus together`,
        duration: 6000,
        action: { label: "Join", onClick: () => navigate("/focus") },
      });
    });
  }, [user, navigate]);

  const handleToggleFocus = async () => {
    await toggleFocusMode();
    if (!isFocusing) {
      setShowFocusBanner(true);
      setTimeout(() => setShowFocusBanner(false), 4000);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const sidebar = (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-sidebar border-r border-sidebar-border/40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border/30">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Lamp className="w-5 h-5 text-primary" strokeWidth={1.5} />
        </div>
        <span className="font-display text-xl font-bold text-sidebar-foreground tracking-tight">
          Lounge
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);

          return (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setMobileMenuOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "text-primary")} strokeWidth={1.5} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User card */}
      <div className="p-3 border-t border-sidebar-border/30">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-sidebar-accent/50 transition-colors cursor-pointer">
          <Avatar className="w-9 h-9 ring-2 ring-sidebar-border/50">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
              {profile?.name ? getInitials(profile.name) : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.name ?? "Team Member"}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">
              {deskPet?.pet_name
                ? `${deskPet.pet_name} · ${STAGE_LABELS[stageIndex(deskPet.xp ?? 0)]}`
                : deskPet
                  ? "Adopt a pet"
                  : "Loading pet..."}
            </p>
          </div>
          <button
            onClick={signOut}
            className="text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
            title="Sign out"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <BackgroundProvider>
    <div className="relative isolate min-h-screen bg-background">
      <AnimatedBackground />

      {/* Focus mode banner */}
      {showFocusBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary/90 backdrop-blur-md text-primary-foreground text-center py-2.5 text-sm font-medium animate-fade-in">
          <Zap className="inline w-4 h-4 mr-1.5" />
          Focus Mode ON — notifications muted. You're in the zone.
        </div>
      )}

      {sidebar}

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-16 flex items-center gap-4 px-4 lg:px-8 bg-background/80 backdrop-blur-xl border-b border-border/30">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted/30 transition-colors"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Coffee className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg font-semibold text-foreground truncate">
              {pageTitle}
            </h1>
          </div>

          {/* Global search */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/20 border border-border/20 text-sm text-muted-foreground min-w-[200px] cursor-pointer hover:bg-muted/30 transition-colors">
            <Search className="w-4 h-4" />
            <span className="flex-1">Search...</span>
            <kbd className="text-[10px] font-mono bg-muted/40 px-1.5 py-0.5 rounded-md">⌘K</kbd>
          </div>

          {/* Focus mode toggle — "The Bat-Signal" */}
          <button
            onClick={handleToggleFocus}
            className={cn(
              "relative p-2 rounded-xl transition-all duration-300",
              isFocusing
                ? "bg-primary/20 text-primary glow-teal"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            )}
            title={isFocusing ? "Exit Focus Mode" : "Enter Focus Mode"}
          >
            <Zap className="w-5 h-5" />
            {isFocusing && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            )}
          </button>

          {/* Notifications */}
          <NotificationBell />

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-xl text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
            title="Toggle theme"
          >
            <SunMoon className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <Avatar className="w-8 h-8 ring-2 ring-border/30">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
              {profile?.name ? getInitials(profile.name) : "?"}
            </AvatarFallback>
          </Avatar>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Global music control (hidden on the Music page) */}
      <MiniPlayer />
    </div>
    </BackgroundProvider>
  );
}
