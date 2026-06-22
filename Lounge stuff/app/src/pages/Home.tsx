import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Coffee,
  GraduationCap,
  Brain,
  ChevronRight,
  Heart,
  MessageCircle,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { currentUser, getUserPet, chillTiles, learnTiles, amaSessions, memePins, users } from '@/data/mockData';
import { Progress } from '@/components/ui/progress';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const navigate = useNavigate();
  const pet = getUserPet(currentUser.id);
  const greeting = useMemo(getGreeting, []);

  const currentAMA = amaSessions.find(a => !a.archived);
  const spotlightUser = currentAMA ? users.find(u => u.id === currentAMA.memberId) : null;
  const latestMemes = memePins.slice(0, 3);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting + Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Greeting & Hero */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="font-display text-3xl font-bold text-[#eeeeee]">
              {greeting}, {currentUser.name.split(' ')[0]}
            </h2>
            <p className="text-[#8b7e7e] mt-1">Here is what is happening in the lounge today.</p>
          </div>

          {/* Desk Pet Hero Card */}
          {pet && (
            <div className="bg-[#134f5c] rounded-2xl p-6 lounge-shadow hover-lift cursor-pointer" onClick={() => navigate('/chill/pets')}>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <img
                    src={pet.image}
                    alt={pet.name}
                    className="w-28 h-28 rounded-2xl object-cover border-2 border-[#1a7a8d]"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-[#0c343d] rounded-full px-2.5 py-1 border border-[#1a7a8d]">
                    <span className="text-xs font-medium text-[#eeeeee] capitalize">{pet.stage}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display text-xl font-semibold text-[#eeeeee]">{pet.name}</h3>
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-sm text-[#8b7e7e] mb-3">
                    {pet.xp >= pet.maxXp ? 'Ready to evolve!' : `${pet.maxXp - pet.xp} XP until next stage`}
                  </p>
                  <Progress value={(pet.xp / pet.maxXp) * 100} className="h-2.5 bg-[#0c343d]" />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-[#8b7e7e]">{pet.xp} / {pet.maxXp} XP</span>
                    <span className="text-xs text-teal-300 font-medium">Day 12 streak</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lounge Entry Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Chill Lounge Card */}
            <button
              onClick={() => navigate('/chill')}
              className="bg-gradient-to-br from-[#134f5c] to-[#8b7e7e]/20 rounded-2xl p-5 text-left lounge-shadow hover-lift transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#8b7e7e]/20 flex items-center justify-center">
                  <Coffee className="w-5 h-5 text-[#8b7e7e]" />
                </div>
                <ChevronRight className="w-5 h-5 text-[#8b7e7e] group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-display font-semibold text-[#eeeeee] text-lg">Chill Lounge</h3>
              <p className="text-sm text-[#8b7e7e] mt-1">Games, music & creative play</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs bg-[#8b7e7e]/10 text-[#8b7e7e] px-2 py-1 rounded-full">{chillTiles[0].stat}</span>
              </div>
            </button>

            {/* Learning Lounge Card */}
            <button
              onClick={() => navigate('/learn')}
              className="bg-gradient-to-br from-[#134f5c] to-[#1a7a8d]/20 rounded-2xl p-5 text-left lounge-shadow hover-lift transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#1a7a8d]/20 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-[#1a7a8d]" />
                </div>
                <ChevronRight className="w-5 h-5 text-[#8b7e7e] group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-display font-semibold text-[#eeeeee] text-lg">Learning Lounge</h3>
              <p className="text-sm text-[#8b7e7e] mt-1">Courses, swaps & brain teasers</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs bg-[#1a7a8d]/10 text-[#1a7a8d] px-2 py-1 rounded-full">{learnTiles[0].stat}</span>
              </div>
            </button>

            {/* Focus Lounge Card */}
            <button
              onClick={() => navigate('/focus')}
              className="bg-gradient-to-br from-[#134f5c] to-[#5a6b6e]/20 rounded-2xl p-5 text-left lounge-shadow hover-lift transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#5a6b6e]/20 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-[#5a6b6e]" />
                </div>
                <ChevronRight className="w-5 h-5 text-[#8b7e7e] group-hover:translate-x-1 transition-transform" />
              </div>
              <h3 className="font-display font-semibold text-[#eeeeee] text-lg">Focus Lounge</h3>
              <p className="text-sm text-[#8b7e7e] mt-1">Pomodoro & group sessions</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs bg-[#5a6b6e]/10 text-[#5a6b6e] px-2 py-1 rounded-full">2 sessions active</span>
              </div>
            </button>
          </div>
        </div>

        {/* Right Column: AMA + Memes */}
        <div className="space-y-6">
          {/* AMA Spotlight */}
          {currentAMA && spotlightUser && (
            <div className="bg-[#134f5c] rounded-2xl lounge-shadow overflow-hidden">
              <div className="relative h-32">
                <img
                  src="/images/ama/spotlight.jpg"
                  alt="AMA Spotlight"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#134f5c] to-transparent" />
                <div className="absolute bottom-3 left-4 flex items-center gap-2">
                  <img
                    src={spotlightUser.avatar}
                    alt={spotlightUser.name}
                    className="w-10 h-10 rounded-full border-2 border-[#134f5c] object-cover"
                  />
                  <div>
                    <p className="text-sm font-medium text-[#eeeeee]">{spotlightUser.name}</p>
                    <p className="text-xs text-[#8b7e7e]">{spotlightUser.role}</p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-medium text-rose-400 uppercase tracking-wider">Today&apos;s AMA</span>
                </div>
                <div className="space-y-1.5">
                  {currentAMA.teaserQuestions.slice(0, 2).map((q, i) => (
                    <p key={i} className="text-sm text-[#eeeeee]/80 truncate">&ldquo;{q}&rdquo;</p>
                  ))}
                </div>
                <button
                  onClick={() => navigate('/learn/ama')}
                  className="mt-3 w-full py-2 rounded-xl bg-[#0c343d] text-sm text-[#eeeeee] hover:bg-[#0c343d]/80 transition-colors"
                >
                  Ask a question
                </button>
              </div>
            </div>
          )}

          {/* Latest Meme Pins */}
          <div className="bg-[#134f5c] rounded-2xl p-4 lounge-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-400" />
                <span className="text-sm font-medium text-[#eeeeee]">Meme Wall</span>
              </div>
              <button
                onClick={() => navigate('/chill/memes')}
                className="text-xs text-[#8b7e7e] hover:text-[#eeeeee] transition-colors"
              >
                View all
              </button>
            </div>
            <div className="space-y-3">
              {latestMemes.map(meme => {
                const poster = users.find(u => u.id === meme.posterId);
                const topReaction = Object.entries(meme.reactions).sort((a, b) => b[1] - a[1])[0];
                return (
                  <div key={meme.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/chill/memes')}>
                    <img
                      src={meme.imageUrl}
                      alt={meme.caption}
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#eeeeee] truncate">{meme.caption}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {poster && (
                          <img src={poster.avatar} alt={poster.name} className="w-4 h-4 rounded-full object-cover" />
                        )}
                        <span className="text-xs text-[#8b7e7e]">{poster?.name}</span>
                        {topReaction && (
                          <span className="text-xs text-[#8b7e7e] ml-auto">{topReaction[1]} reactions</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Brain Teaser Teaser */}
          <div className="bg-gradient-to-br from-[#134f5c] to-[#0c343d] rounded-2xl p-4 lounge-shadow">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-[#eeeeee]">Today&apos;s Puzzle</span>
            </div>
            <p className="text-sm text-[#8b7e7e] mb-3">Have you solved today&apos;s brain teaser?</p>
            <button
              onClick={() => navigate('/learn/leaderboard')}
              className="w-full py-2 rounded-xl bg-[#1a7a8d] text-sm text-[#eeeeee] hover:bg-[#1a7a8d]/80 transition-colors"
            >
              Solve now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
