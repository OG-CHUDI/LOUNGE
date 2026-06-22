import { NavLink } from 'react-router';
import {
  Home,
  Coffee,
  GraduationCap,
  Brain,
  Settings,
  Sparkles,
} from 'lucide-react';
import { currentUser, getUserPet } from '@/data/mockData';
import { useTheme } from '@/contexts/ThemeContext';

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/chill', icon: Coffee, label: 'Chill Lounge' },
  { to: '/learn', icon: GraduationCap, label: 'Learning Lounge' },
  { to: '/focus', icon: Brain, label: 'Focus Lounge' },
];

export default function Sidebar() {
  const { isDark } = useTheme();
  const pet = getUserPet(currentUser.id);

  return (
    <aside
      className={`fixed left-0 top-0 h-full w-20 lg:w-64 flex flex-col z-40 transition-colors duration-300 ${
        isDark ? 'bg-[#0c343d] border-r border-[#8b7e7e]/20' : 'bg-[#f5f5f5] border-r border-[#8b7e7e]/20'
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#134f5c] flex items-center justify-center lounge-shadow">
            <Sparkles className="w-5 h-5 text-[#eeeeee]" />
          </div>
          <span className="hidden lg:block font-display font-bold text-xl text-[#eeeeee] dark-text">
            AIENAI
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-[#134f5c] text-[#eeeeee] lounge-shadow'
                  : isDark
                  ? 'text-[#8b7e7e] hover:bg-[#134f5c]/40 hover:text-[#eeeeee]'
                  : 'text-[#8b7e7e] hover:bg-[#134f5c]/20 hover:text-[#0c343d]'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className="hidden lg:block font-medium text-sm">{item.label}</span>
            {item.to === '/focus' && (
              <span className="hidden lg:block ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: User Card */}
      <div className="p-3">
        <div
          className={`rounded-xl p-3 transition-colors ${
            isDark ? 'bg-[#134f5c]/40' : 'bg-[#134f5c]/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-[#134f5c]"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0c343d]" />
            </div>
            <div className="hidden lg:block flex-1 min-w-0">
              <p className="text-sm font-medium text-[#eeeeee] truncate">{currentUser.name}</p>
              <p className="text-xs text-[#8b7e7e] truncate">{currentUser.role}</p>
            </div>
            {pet && (
              <img
                src={pet.image}
                alt={pet.name}
                className="hidden lg:block w-8 h-8 rounded-full object-cover border border-[#8b7e7e]/30"
              />
            )}
          </div>
          <button
            className={`hidden lg:flex items-center gap-2 mt-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
              isDark
                ? 'text-[#8b7e7e] hover:bg-[#134f5c] hover:text-[#eeeeee]'
                : 'text-[#8b7e7e] hover:bg-[#134f5c]/30 hover:text-[#0c343d]'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
