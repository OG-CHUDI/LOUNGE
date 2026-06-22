import { Routes, Route } from 'react-router';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FocusModeProvider } from '@/contexts/FocusModeContext';
import AppLayout from '@/components/AppLayout';
import Home from '@/pages/Home';
import ChillLounge from '@/pages/chill/ChillLounge';
import GamesPage from '@/pages/chill/GamesPage';
import MusicPage from '@/pages/chill/MusicPage';
import CanvasPage from '@/pages/chill/CanvasPage';
import DeskPetsPage from '@/pages/chill/DeskPetsPage';
import MemeWallPage from '@/pages/chill/MemeWallPage';
import LearningLounge from '@/pages/learn/LearningLounge';
import CoursesPage from '@/pages/learn/CoursesPage';
import SkillSwapPage from '@/pages/learn/SkillSwapPage';
import LeaderboardPage from '@/pages/learn/LeaderboardPage';
import AMAPage from '@/pages/learn/AMAPage';
import FocusLounge from '@/pages/focus/FocusLounge';

export default function App() {
  return (
    <ThemeProvider>
      <FocusModeProvider>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Home />} />
            {/* Chill Lounge Routes */}
            <Route path="/chill" element={<ChillLounge />} />
            <Route path="/chill/games" element={<GamesPage />} />
            <Route path="/chill/music" element={<MusicPage />} />
            <Route path="/chill/canvas" element={<CanvasPage />} />
            <Route path="/chill/pets" element={<DeskPetsPage />} />
            <Route path="/chill/memes" element={<MemeWallPage />} />
            {/* Learning Lounge Routes */}
            <Route path="/learn" element={<LearningLounge />} />
            <Route path="/learn/courses" element={<CoursesPage />} />
            <Route path="/learn/skill-swap" element={<SkillSwapPage />} />
            <Route path="/learn/leaderboard" element={<LeaderboardPage />} />
            <Route path="/learn/ama" element={<AMAPage />} />
            {/* Focus Lounge Route */}
            <Route path="/focus" element={<FocusLounge />} />
          </Routes>
        </AppLayout>
      </FocusModeProvider>
    </ThemeProvider>
  );
}
