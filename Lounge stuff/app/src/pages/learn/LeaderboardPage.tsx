import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  Trophy,
  Timer,
  Flame,
  Crown,
  Medal,
  Award,
} from 'lucide-react';
import { leaderboard, users, currentUser } from '@/data/mockData';
import { Input } from '@/components/ui/input';

// Daily puzzle - simple riddle
const TODAY_PUZZLE = {
  question: 'I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. I have roads, but no cars. What am I?',
  answer: 'map',
  hint: 'You use me to find your way.',
};

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [answer, setAnswer] = useState('');
  const [solved, setSolved] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    if (isRunning) return;
    setIsRunning(true);
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
  };

  const stopTimer = () => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleSubmit = () => {
    if (answer.toLowerCase().trim() === TODAY_PUZZLE.answer) {
      stopTimer();
      setSolved(true);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const weeklyWinners = leaderboard.slice(0, 3);

  const rankIcons = [Crown, Medal, Award];

  return (
    <div className="space-y-6 animate-fade-in">
      <button
        onClick={() => navigate('/learn')}
        className="flex items-center gap-2 text-[#8b7e7e] hover:text-[#eeeeee] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Learning Lounge</span>
      </button>

      <div>
        <h2 className="font-display text-3xl font-bold text-[#eeeeee] mb-1">Brain Teaser Leaderboard</h2>
        <p className="text-[#8b7e7e]">Solve today&apos;s puzzle and climb the ranks.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Puzzle Card */}
        <div className="lg:col-span-2">
          <div className="bg-[#134f5c] rounded-2xl p-6 lounge-shadow">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="font-display font-semibold text-[#eeeeee]">Today&apos;s Puzzle</h3>
            </div>

            <div className="bg-[#0c343d]/40 rounded-xl p-5 mb-4">
              <p className="text-[#eeeeee] text-lg leading-relaxed">{TODAY_PUZZLE.question}</p>
              {showHint && (
                <p className="text-sm text-[#1a7a8d] mt-3 animate-fade-in">Hint: {TODAY_PUZZLE.hint}</p>
              )}
            </div>

            {!solved ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-[#0c343d]/40 rounded-lg px-3 py-2">
                    <Timer className="w-4 h-4 text-[#8b7e7e]" />
                    <span className="text-sm text-[#eeeeee] font-mono">{formatTime(timer)}</span>
                  </div>
                  <button
                    onClick={startTimer}
                    className="text-xs text-[#8b7e7e] hover:text-[#eeeeee] transition-colors underline"
                  >
                    {isRunning ? 'Timer running...' : 'Start timer'}
                  </button>
                  <button
                    onClick={() => setShowHint(true)}
                    className="text-xs text-[#1a7a8d] hover:text-[#22a0b8] transition-colors underline ml-auto"
                  >
                    Need a hint?
                  </button>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    placeholder="Your answer..."
                    className="bg-[#282828] border-[#8b7e7e]/20 text-[#eeeeee] placeholder:text-[#8b7e7e]"
                  />
                  <button
                    onClick={handleSubmit}
                    className="px-5 py-2 rounded-xl bg-[#1a7a8d] text-[#eeeeee] font-medium hover:bg-[#1a7a8d]/80 transition-colors"
                  >
                    Submit
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4 text-center animate-fade-in">
                <Trophy className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-lg font-display font-semibold text-[#eeeeee]">Correct!</p>
                <p className="text-sm text-[#8b7e7e]">Solved in {formatTime(timer)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Weekly Winners */}
        <div className="bg-[#134f5c] rounded-2xl p-5 lounge-shadow">
          <h3 className="font-display font-semibold text-[#eeeeee] mb-4 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" /> Weekly Winners
          </h3>
          <div className="space-y-3">
            {weeklyWinners.map((entry, i) => {
              const user = users.find(u => u.id === entry.userId);
              const RankIcon = rankIcons[i] || Award;
              const colors = ['text-amber-400', 'text-gray-300', 'text-amber-600'];
              return (
                <div key={entry.userId} className="flex items-center gap-3 bg-[#0c343d]/40 rounded-xl p-3">
                  <RankIcon className={`w-6 h-6 ${colors[i]}`} />
                  <img src={user?.avatar} alt={user?.name} className="w-10 h-10 rounded-full object-cover" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#eeeeee]">{user?.name}</p>
                    <p className="text-xs text-[#8b7e7e]">{entry.streak} day streak</p>
                  </div>
                  <span className="text-sm font-display font-bold text-[#eeeeee]">{entry.solveTime}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-[#134f5c] rounded-2xl p-5 lounge-shadow">
        <h3 className="font-display font-semibold text-[#eeeeee] mb-4">Today&apos;s Leaderboard</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-[#8b7e7e] uppercase tracking-wider">
                <th className="pb-3 font-medium">Rank</th>
                <th className="pb-3 font-medium">Member</th>
                <th className="pb-3 font-medium">Solve Time</th>
                <th className="pb-3 font-medium">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#8b7e7e]/10">
              {leaderboard.map(entry => {
                const user = users.find(u => u.id === entry.userId);
                const isCurrentUser = entry.userId === currentUser.id;
                return (
                  <tr key={entry.userId} className={isCurrentUser ? 'bg-[#1a7a8d]/10' : ''}>
                    <td className="py-3">
                      <span className={`text-sm font-display font-bold ${entry.rank <= 3 ? 'text-amber-400' : 'text-[#8b7e7e]'}`}>
                        #{entry.rank}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <img src={user?.avatar} alt={user?.name} className="w-8 h-8 rounded-full object-cover" />
                        <div>
                          <p className={`text-sm font-medium ${isCurrentUser ? 'text-teal-300' : 'text-[#eeeeee]'}`}>
                            {user?.name} {isCurrentUser && '(You)'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-[#eeeeee]">{entry.solveTime}</td>
                    <td className="py-3">
                      <span className="flex items-center gap-1 text-sm text-orange-400">
                        <Flame className="w-3.5 h-3.5" /> {entry.streak}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
