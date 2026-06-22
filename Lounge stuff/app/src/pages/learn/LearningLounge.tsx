import { useNavigate } from 'react-router';
import {
  GraduationCap,
  ArrowLeftRight,
  Trophy,
  MessageCircle,
  ChevronRight,
} from 'lucide-react';
import { learnTiles } from '@/data/mockData';

const iconMap: Record<string, React.ElementType> = {
  GraduationCap,
  ArrowLeftRight,
  Trophy,
  MessageCircle,
};

export default function LearningLounge() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center py-8">
        <h2 className="font-display text-4xl font-bold text-[#eeeeee] mb-2">Learning Lounge</h2>
        <p className="text-[#8b7e7e]">Grow your skills and share what you know.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {learnTiles.map((tile) => {
          const Icon = iconMap[tile.icon] || GraduationCap;
          return (
            <button
              key={tile.id}
              onClick={() => navigate(tile.route)}
              className="bg-[#134f5c] rounded-2xl p-6 lounge-shadow hover-lift transition-all group text-left"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${tile.color}`}>
                  <Icon className="w-7 h-7" />
                </div>
                <ChevronRight className="w-5 h-5 text-[#8b7e7e] group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-display text-xl font-semibold text-[#eeeeee] mb-1">{tile.title}</h3>
              <p className="text-sm text-[#8b7e7e] mb-3">{tile.description}</p>
              <span className="inline-block text-xs bg-[#0c343d]/60 text-[#8b7e7e] px-3 py-1.5 rounded-full">
                {tile.stat}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
