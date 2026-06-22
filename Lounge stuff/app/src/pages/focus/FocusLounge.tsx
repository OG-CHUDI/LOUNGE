import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Users,
  Zap,
  VolumeX,
  Timer,
  Plus,
  LogIn,
} from 'lucide-react';
import { useFocusMode } from '@/contexts/FocusModeContext';
import { focusSessions, users, currentUser } from '@/data/mockData';

const WORK_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

export default function FocusLounge() {
  const { enabled: focusMode, toggle: toggleFocusMode } = useFocusMode();
  const [timeLeft, setTimeLeft] = useState(WORK_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [sessions, setSessions] = useState(focusSessions);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const tick = useCallback(() => {
    setTimeLeft(prev => {
      if (prev <= 1) {
        setIsRunning(false);
        setIsBreak(b => !b);
        return isBreak ? WORK_TIME : BREAK_TIME;
      }
      return prev - 1;
    });
  }, [isBreak]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(tick, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, tick]);

  const toggleTimer = () => setIsRunning(r => !r);

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(isBreak ? BREAK_TIME : WORK_TIME);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = ((isBreak ? BREAK_TIME : WORK_TIME) - timeLeft) / (isBreak ? BREAK_TIME : WORK_TIME) * 100;

  const focusUsers = users.filter(u => u.status === 'focus');

  const handleStartSession = () => {
    const newSession = {
      id: `fs-${Date.now()}`,
      hostId: currentUser.id,
      participants: [currentUser.id],
      timeRemaining: 25,
      totalTime: 25,
      isActive: true,
    };
    setSessions([...sessions, newSession]);
  };

  const handleJoinSession = (sessionId: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      if (s.participants.includes(currentUser.id)) return s;
      return { ...s, participants: [...s.participants, currentUser.id] };
    }));
  };

  // SVG circle for progress ring
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center py-4">
        <h2 className="font-display text-4xl font-bold text-[#eeeeee] mb-2">Focus Lounge</h2>
        <p className="text-[#8b7e7e]">Quiet space for deep work. Minimise distractions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pomodoro Timer - Large */}
        <div className="lg:col-span-2">
          <div className="bg-[#134f5c] rounded-2xl p-8 lounge-shadow flex flex-col items-center">
            <div className="flex items-center gap-2 mb-6">
              <Timer className="w-5 h-5 text-[#5a6b6e]" />
              <span className="text-sm text-[#8b7e7e] uppercase tracking-wider">
                {isBreak ? 'Break Time' : 'Focus Time'}
              </span>
            </div>

            {/* Timer Ring */}
            <div className="relative mb-8">
              <svg width="280" height="280" className="-rotate-90">
                <circle
                  cx="140"
                  cy="140"
                  r={radius}
                  fill="none"
                  stroke="#0c343d"
                  strokeWidth="12"
                />
                <circle
                  cx="140"
                  cy="140"
                  r={radius}
                  fill="none"
                  stroke={isBreak ? '#1a7a8d' : '#5a6b6e'}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-6xl font-bold text-[#eeeeee] tabular-nums">
                  {formatTime(timeLeft)}
                </span>
                <span className="text-sm text-[#8b7e7e] mt-1">
                  {isBreak ? 'Take a breather' : 'Stay focused'}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={resetTimer}
                className="p-3 rounded-xl bg-[#0c343d] text-[#8b7e7e] hover:text-[#eeeeee] transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={toggleTimer}
                className={`p-5 rounded-2xl transition-all lounge-shadow ${
                  isRunning
                    ? 'bg-[#8b7e7e]/20 text-[#eeeeee] hover:bg-[#8b7e7e]/30'
                    : 'bg-[#5a6b6e] text-[#eeeeee] hover:bg-[#5a6b6e]/80'
                }`}
              >
                {isRunning ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>
              <button
                onClick={() => { setIsBreak(!isBreak); setTimeLeft(isBreak ? WORK_TIME : BREAK_TIME); setIsRunning(false); }}
                className="px-4 py-3 rounded-xl bg-[#0c343d] text-[#8b7e7e] hover:text-[#eeeeee] transition-colors text-sm"
              >
                {isBreak ? 'Work' : 'Break'}
              </button>
            </div>
          </div>

          {/* Who's in Focus */}
          <div className="bg-[#134f5c] rounded-2xl p-5 lounge-shadow mt-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-[#5a6b6e]" />
              <h3 className="font-display font-semibold text-[#eeeeee]">Who&apos;s in focus right now</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              {focusUsers.length === 0 ? (
                <p className="text-sm text-[#8b7e7e]">No one is in focus mode right now.</p>
              ) : (
                focusUsers.map(user => (
                  <div key={user.id} className="flex items-center gap-2 bg-[#0c343d]/40 rounded-xl px-3 py-2">
                    <div className="relative">
                      <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#5a6b6e] border border-[#0c343d]" />
                    </div>
                    <span className="text-sm text-[#eeeeee]">{user.name}</span>
                  </div>
                ))
              )}
              {/* Current user if not in list */}
              {focusMode && !focusUsers.find(u => u.id === currentUser.id) && (
                <div className="flex items-center gap-2 bg-[#1a7a8d]/20 rounded-xl px-3 py-2 ring-1 ring-[#1a7a8d]">
                  <div className="relative">
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#5a6b6e] border border-[#0c343d]" />
                  </div>
                  <span className="text-sm text-teal-300">You</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Group Sessions + Focus Mode */}
        <div className="space-y-5">
          {/* Group Sessions */}
          <div className="bg-[#134f5c] rounded-2xl p-5 lounge-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-[#eeeeee]">Group Sessions</h3>
              <button
                onClick={handleStartSession}
                className="p-2 rounded-lg bg-[#0c343d] text-[#8b7e7e] hover:text-[#eeeeee] transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {sessions.map(session => {
                const host = users.find(u => u.id === session.hostId);
                return (
                  <div key={session.id} className="bg-[#0c343d]/40 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <img src={host?.avatar} alt={host?.name} className="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <p className="text-sm font-medium text-[#eeeeee]">{host?.name}&apos;s session</p>
                        <p className="text-xs text-[#8b7e7e]">{session.timeRemaining} min remaining</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {session.participants.slice(0, 3).map(pid => {
                          const p = users.find(u => u.id === pid);
                          return p ? <img key={pid} src={p.avatar} alt={p.name} className="w-6 h-6 rounded-full border border-[#0c343d]" /> : null;
                        })}
                        {session.participants.length > 3 && (
                          <span className="w-6 h-6 rounded-full bg-[#134f5c] border border-[#0c343d] flex items-center justify-center text-[10px] text-[#8b7e7e]">
                            +{session.participants.length - 3}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleJoinSession(session.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                          session.participants.includes(currentUser.id)
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-[#1a7a8d]/20 text-[#1a7a8d] hover:bg-[#1a7a8d]/30'
                        }`}
                      >
                        {session.participants.includes(currentUser.id) ? (
                          <>Joined</>
                        ) : (
                          <><LogIn className="w-3 h-3" /> Join</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
              {sessions.length === 0 && (
                <p className="text-sm text-[#8b7e7e] text-center py-4">No active sessions. Start one!</p>
              )}
            </div>
          </div>

          {/* Focus Mode Control */}
          <div className="bg-[#134f5c] rounded-2xl p-5 lounge-shadow">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-teal-300" />
              <h3 className="font-display font-semibold text-[#eeeeee]">Focus Mode</h3>
            </div>
            <p className="text-sm text-[#8b7e7e] mb-4">
              When enabled, Focus Mode mutes non-urgent notifications and signals to the team that you are in deep work.
            </p>
            <button
              onClick={toggleFocusMode}
              className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
                focusMode
                  ? 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30'
                  : 'bg-[#5a6b6e] text-[#eeeeee] hover:bg-[#5a6b6e]/80'
              }`}
            >
              {focusMode ? (
                <span className="flex items-center justify-center gap-2">
                  <VolumeX className="w-4 h-4" /> Disable Focus Mode
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4" /> Enable Focus Mode
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
