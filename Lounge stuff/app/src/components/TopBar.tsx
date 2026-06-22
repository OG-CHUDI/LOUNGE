import { useLocation } from 'react-router';
import {
  Search,
  Bell,
  Moon,
  Sun,
  Zap,
  X,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useFocusMode } from '@/contexts/FocusModeContext';
import { currentUser, notifications } from '@/data/mockData';
import { useState } from 'react';

const pageTitles: Record<string, string> = {
  '/': 'Home',
  '/chill': 'Chill Lounge',
  '/chill/games': 'Games',
  '/chill/music': 'Music',
  '/chill/canvas': 'Collaborative Canvas',
  '/chill/pets': 'Desk Pets',
  '/chill/memes': 'Meme Wall',
  '/learn': 'Learning Lounge',
  '/learn/courses': 'Mini-Courses',
  '/learn/skill-swap': 'Skill Swap Board',
  '/learn/leaderboard': 'Brain Teaser Leaderboard',
  '/learn/ama': 'AMA Archive',
  '/focus': 'Focus Lounge',
};

export default function TopBar() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const { enabled: focusMode, toggle: toggleFocus } = useFocusMode();
  const location = useLocation();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const title = pageTitles[location.pathname] || 'Lounge';
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      {/* Focus Mode Banner */}
      {focusMode && (
        <div className="fixed top-0 left-20 lg:left-64 right-0 z-40 bg-[#134f5c]/90 backdrop-blur-sm text-[#eeeeee] px-6 py-2 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-teal-300 animate-pulse" />
            <span className="text-sm font-medium">Focus Mode active — notifications muted</span>
          </div>
          <button onClick={toggleFocus} className="text-[#8b7e7e] hover:text-[#eeeeee] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <header
        className={`h-16 flex items-center justify-between px-6 sticky top-0 z-30 transition-colors duration-300 ${
          focusMode ? 'mt-0' : ''
        } ${isDark ? 'bg-[#0c343d]/80' : 'bg-[#eeeeee]/80'} backdrop-blur-md`}
      >
        {/* Page Title */}
        <h1 className="font-display text-2xl font-semibold text-[#eeeeee]">{title}</h1>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2.5 rounded-xl transition-colors ${
                isDark ? 'hover:bg-[#134f5c]/40 text-[#8b7e7e]' : 'hover:bg-[#134f5c]/20 text-[#8b7e7e]'
              }`}
            >
              <Search className="w-5 h-5" />
            </button>
            {showSearch && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-[#134f5c] rounded-xl lounge-shadow-lg p-3 animate-scale-in z-50">
                <input
                  type="text"
                  placeholder="Search across Lounge..."
                  autoFocus
                  className="w-full bg-[#282828] text-[#eeeeee] placeholder-[#8b7e7e] rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#1a7a8d]"
                />
                <div className="mt-2 text-xs text-[#8b7e7e] px-1">Press Enter to search</div>
              </div>
            )}
          </div>

          {/* Focus Mode Toggle (Bat-Signal) */}
          <button
            onClick={toggleFocus}
            title="Focus Mode"
            className={`p-2.5 rounded-xl transition-all duration-300 ${
              focusMode
                ? 'bg-[#134f5c] text-teal-300 animate-pulse-glow'
                : isDark
                ? 'hover:bg-[#134f5c]/40 text-[#8b7e7e]'
                : 'hover:bg-[#134f5c]/20 text-[#8b7e7e]'
            }`}
          >
            <Zap className="w-5 h-5" />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className={`p-2.5 rounded-xl transition-colors relative ${
                isDark ? 'hover:bg-[#134f5c]/40 text-[#8b7e7e]' : 'hover:bg-[#134f5c]/20 text-[#8b7e7e]'
              }`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifs && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-[#134f5c] rounded-xl lounge-shadow-lg p-3 animate-scale-in z-50">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-sm font-medium text-[#eeeeee]">Notifications</span>
                  <button onClick={() => setShowNotifs(false)} className="text-[#8b7e7e] hover:text-[#eeeeee]">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-sm text-[#8b7e7e] px-1 py-2">No notifications</p>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`p-2.5 rounded-lg mb-1 ${n.read ? 'opacity-60' : 'bg-[#0c343d]/40'}`}>
                      <p className="text-sm font-medium text-[#eeeeee]">{n.title}</p>
                      <p className="text-xs text-[#8b7e7e]">{n.body}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl transition-colors ${
              isDark ? 'hover:bg-[#134f5c]/40 text-[#8b7e7e]' : 'hover:bg-[#134f5c]/20 text-[#8b7e7e]'
            }`}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* User Avatar */}
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-9 h-9 rounded-full object-cover border-2 border-[#134f5c] ml-1"
          />
        </div>
      </header>
    </>
  );
}
