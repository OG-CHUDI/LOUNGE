import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "@/components/AppShell";
import { MusicProvider } from "@/components/music/MusicProvider";
import { FocusProvider } from "@/components/focus/FocusProvider";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Chill from "@/pages/Chill";
import ChillGames from "@/pages/ChillGames";
import ChillMusic from "@/pages/ChillMusic";
import ChillCanvas from "@/pages/ChillCanvas";
import ChillPets from "@/pages/ChillPets";
import ChillMemes from "@/pages/ChillMemes";
import Learn from "@/pages/Learn";
import LearnCourses from "@/pages/LearnCourses";
import CourseEditor from "@/pages/CourseEditor";
import CoursePlayer from "@/pages/CoursePlayer";
import LearnSkillSwap from "@/pages/LearnSkillSwap";
import LearnLeaderboard from "@/pages/LearnLeaderboard";
import LearnAma from "@/pages/LearnAma";
import Focus from "@/pages/Focus";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Entering the lounge...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Entering the lounge...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="chill" element={<Chill />} />
        <Route path="chill/games" element={<ChillGames />} />
        <Route path="chill/music" element={<ChillMusic />} />
        <Route path="chill/canvas" element={<ChillCanvas />} />
        <Route path="chill/pets" element={<ChillPets />} />
        <Route path="chill/memes" element={<ChillMemes />} />
        <Route path="learn" element={<Learn />} />
        <Route path="learn/courses" element={<LearnCourses />} />
        <Route path="learn/courses/new" element={<CourseEditor />} />
        <Route path="learn/courses/:id" element={<CoursePlayer />} />
        <Route path="learn/courses/:id/edit" element={<CourseEditor />} />
        <Route path="learn/skill-swap" element={<LearnSkillSwap />} />
        <Route path="learn/leaderboard" element={<LearnLeaderboard />} />
        <Route path="learn/ama" element={<LearnAma />} />
        <Route path="focus" element={<Focus />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <FocusProvider>
            <MusicProvider>
              <Toaster />
              <Sonner />
              <AppRoutes />
            </MusicProvider>
          </FocusProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
