// Lounge Mock Data
// TODO: Replace with API calls when backend is connected.
// All data is local and ephemeral - changes are lost on refresh.

import type {
  User,
  DeskPet,
  MemePin,
  Game,
  Playlist,
  Course,
  SkillSwap,
  LeaderboardEntry,
  AMASession,
  FocusSession,
  Notification,
  LoungeTile,
} from './types';

// ─── Users ───────────────────────────────────────────────
export const users: User[] = [
  { id: 'u1', name: 'Maya Chen', role: 'Lead Designer', avatar: '/images/avatars/maya.jpg', status: 'online', currentTrack: 'Midnight City - M83', petId: 'p1' },
  { id: 'u2', name: 'Jake Morrison', role: 'Senior Developer', avatar: '/images/avatars/jake.jpg', status: 'focus', currentTrack: 'Weightless - Marconi Union', petId: 'p2' },
  { id: 'u3', name: 'Sarah Okafor', role: 'Creative Director', avatar: '/images/avatars/sarah.jpg', status: 'online', currentTrack: 'Breathe - Télépopmusik', petId: 'p3' },
  { id: 'u4', name: 'David Park', role: 'Full-stack Engineer', avatar: '/images/avatars/david.jpg', status: 'away', currentTrack: 'Porcelain - Moby', petId: 'p4' },
  { id: 'u5', name: 'Emma Larsson', role: 'Product Designer', avatar: '/images/avatars/emma.jpg', status: 'online', currentTrack: 'Sunset Lover - Petit Biscuit', petId: 'p5' },
  { id: 'u6', name: 'Alex Rivera', role: 'DesignOps Lead', avatar: '/images/avatars/alex.jpg', status: 'focus', currentTrack: 'Intro - The xx', petId: 'p6' },
];

export const currentUser = users[0]; // Logged in as Maya

// ─── Desk Pets ───────────────────────────────────────────
export const deskPets: DeskPet[] = [
  { id: 'p1', name: 'Blobby', image: '/images/pets/blobby.jpg', stage: 'adult', xp: 780, maxXp: 1000, ownerId: 'u1', customizations: { hat: 'wizard', accessory: 'glasses', aura: 'golden' } },
  { id: 'p2', name: 'Foxie', image: '/images/pets/foxie.jpg', stage: 'teen', xp: 420, maxXp: 600, ownerId: 'u2', customizations: { hat: 'none', accessory: 'bowtie', aura: 'teal' } },
  { id: 'p3', name: 'Crystal', image: '/images/pets/crystal.jpg', stage: 'sage', xp: 950, maxXp: 1000, ownerId: 'u3', customizations: { hat: 'crown', accessory: 'none', aura: 'cyan' } },
  { id: 'p4', name: 'Sprout', image: '/images/pets/sprout.jpg', stage: 'baby', xp: 150, maxXp: 300, ownerId: 'u4', customizations: { hat: 'none', accessory: 'leaf', aura: 'green' } },
  { id: 'p5', name: 'Stella', image: '/images/pets/stella.jpg', stage: 'adult', xp: 650, maxXp: 1000, ownerId: 'u5', customizations: { hat: 'star', accessory: 'wand', aura: 'purple' } },
  { id: 'p6', name: 'Wormie', image: '/images/pets/wormie.jpg', stage: 'teen', xp: 380, maxXp: 600, ownerId: 'u6', customizations: { hat: 'grad-cap', accessory: 'book', aura: 'warm' } },
];

// ─── Meme Pins ───────────────────────────────────────────
export const memePins: MemePin[] = [
  { id: 'm1', imageUrl: '/images/memes/meme-1.jpg', caption: 'Friday night debugging sessions hit different', posterId: 'u2', reactions: { fire: 12, laugh: 8, heart: 3 }, timestamp: '2026-06-19T10:00:00Z' },
  { id: 'm2', imageUrl: '/images/memes/meme-2.jpg', caption: 'Every designer desk ever', posterId: 'u1', reactions: { fire: 6, laugh: 15, heart: 7 }, timestamp: '2026-06-19T09:30:00Z' },
  { id: 'm3', imageUrl: '/images/memes/meme-3.jpg', caption: 'When the standup runs 45 minutes', posterId: 'u5', reactions: { fire: 3, laugh: 20, heart: 4 }, timestamp: '2026-06-18T16:00:00Z' },
  { id: 'm4', imageUrl: '/images/memes/meme-4.jpg', caption: 'Business on top, party on bottom', posterId: 'u4', reactions: { fire: 8, laugh: 11, heart: 9 }, timestamp: '2026-06-18T14:00:00Z' },
  { id: 'm5', imageUrl: '/images/memes/meme-5.jpg', caption: 'Client feedback in a nutshell', posterId: 'u3', reactions: { fire: 4, laugh: 18, heart: 2 }, timestamp: '2026-06-17T11:00:00Z' },
  { id: 'm6', imageUrl: '/images/memes/meme-6.jpg', caption: 'Two minutes to deadline', posterId: 'u6', reactions: { fire: 14, laugh: 9, heart: 5 }, timestamp: '2026-06-17T08:00:00Z' },
];

// ─── Games ───────────────────────────────────────────────
export const games: Game[] = [
  { id: 'g1', title: 'Memory Match', cover: '/images/games/memory-match.jpg', category: 'solo', avgPlayTime: '3 min', description: 'Test your recall with a classic card-matching game. Find all pairs before time runs out!', status: 'live', playersToday: 24 },
  { id: 'g2', title: 'Number Slide', cover: '/images/games/number-puzzle.jpg', category: 'solo', avgPlayTime: '5 min', description: 'Slide numbered tiles into order. A brain-teasing puzzle that gets harder as you improve.', status: 'live', playersToday: 18 },
  { id: 'g3', title: 'Word Link', cover: '/images/games/word-link.jpg', category: 'head-to-head', avgPlayTime: '8 min', description: 'Challenge a teammate to find word connections. Coming soon!', status: 'coming-soon', playersToday: 0 },
  { id: 'g4', title: 'Sketch Rush', cover: '/images/games/sketch-rush.jpg', category: 'head-to-head', avgPlayTime: '10 min', description: 'Draw against the clock! Teammates guess your sketches. Coming soon!', status: 'coming-soon', playersToday: 0 },
];

// ─── Playlists ───────────────────────────────────────────
export const playlists: Playlist[] = [
  { id: 'pl1', title: 'Deep Focus Flow', cover: '/images/playlists/lofi-focus.jpg', curatorId: 'u2', spotifyUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO', trackCount: 42 },
  { id: 'pl2', title: 'Retro Synthwave', cover: '/images/playlists/retro-vibes.jpg', curatorId: 'u6', spotifyUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX1n9whBa0GxX', trackCount: 68 },
  { id: 'pl3', title: 'Calm Tides', cover: '/images/playlists/calm-tides.jpg', curatorId: 'u5', spotifyUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX4wta20PHgwo', trackCount: 35 },
  { id: 'pl4', title: 'Energy Boost', cover: '/images/playlists/energy-boost.jpg', curatorId: 'u3', spotifyUrl: 'https://open.spotify.com/embed/playlist/37i9dQZF1DX76Wlfdnj7AP', trackCount: 55 },
];

// ─── Courses ─────────────────────────────────────────────
export const courses: Course[] = [
  { id: 'c1', title: 'Design Systems Fundamentals', cover: '/images/courses/design-systems.jpg', duration: '4h 30m', category: 'Design', progress: 75, instructor: 'Sarah Okafor', lessons: 24 },
  { id: 'c2', title: 'Creative Coding with p5.js', cover: '/images/courses/creative-coding.jpg', duration: '6h 15m', category: 'Development', progress: 30, instructor: 'Jake Morrison', lessons: 32 },
  { id: 'c3', title: 'Typography Mastery', cover: '/images/courses/typography.jpg', duration: '3h 45m', category: 'Design', progress: 0, instructor: 'Alex Rivera', lessons: 18 },
  { id: 'c4', title: 'Motion Design Principles', cover: '/images/courses/motion-design.jpg', duration: '5h 00m', category: 'Animation', progress: 10, instructor: 'Emma Larsson', lessons: 28 },
  { id: 'c5', title: 'Color Theory Deep Dive', cover: '/images/courses/color-theory.jpg', duration: '2h 30m', category: 'Design', progress: 0, instructor: 'Maya Chen', lessons: 12 },
  { id: 'c6', title: 'User Research Methods', cover: '/images/courses/user-research.jpg', duration: '4h 00m', category: 'Research', progress: 50, instructor: 'David Park', lessons: 20 },
];

// ─── Skill Swaps ─────────────────────────────────────────
export const skillSwaps: SkillSwap[] = [
  { id: 's1', type: 'offering', userId: 'u1', skill: 'Figma Advanced Prototyping', blurb: 'Happy to share tips on interactive components, auto-layout, and advanced prototyping. 30-min sessions.', tags: ['Design', 'Figma'], timestamp: '2026-06-19T08:00:00Z' },
  { id: 's2', type: 'seeking', userId: 'u1', skill: 'React Animations', blurb: 'Want to level up my React animation skills. Looking for someone who knows Framer Motion well.', tags: ['Development', 'React'], timestamp: '2026-06-18T10:00:00Z' },
  { id: 's3', type: 'offering', userId: 'u2', skill: 'TypeScript Patterns', blurb: 'Can help with advanced TS patterns, generics, and type guards. Pair programming welcome!', tags: ['Development', 'TypeScript'], timestamp: '2026-06-19T09:00:00Z' },
  { id: 's4', type: 'seeking', userId: 'u2', skill: 'Visual Design Critique', blurb: 'Need fresh eyes on my side project UI. Looking for design feedback sessions.', tags: ['Design', 'Feedback'], timestamp: '2026-06-17T14:00:00Z' },
  { id: 's5', type: 'offering', userId: 'u3', skill: 'Creative Direction', blurb: 'Open to mentoring on creative direction, brand strategy, and leading design teams.', tags: ['Leadership', 'Strategy'], timestamp: '2026-06-19T07:00:00Z' },
  { id: 's6', type: 'seeking', userId: 'u5', skill: 'Frontend Performance', blurb: 'Want to learn optimization techniques for heavy design-heavy web apps.', tags: ['Development', 'Performance'], timestamp: '2026-06-16T11:00:00Z' },
];

// ─── Leaderboard ─────────────────────────────────────────
export const leaderboard: LeaderboardEntry[] = [
  { rank: 1, userId: 'u3', solveTime: '0:42', streak: 12, date: '2026-06-19' },
  { rank: 2, userId: 'u2', solveTime: '0:58', streak: 8, date: '2026-06-19' },
  { rank: 3, userId: 'u6', solveTime: '1:15', streak: 5, date: '2026-06-19' },
  { rank: 4, userId: 'u1', solveTime: '1:32', streak: 3, date: '2026-06-19' },
  { rank: 5, userId: 'u5', solveTime: '1:48', streak: 2, date: '2026-06-19' },
  { rank: 6, userId: 'u4', solveTime: '2:05', streak: 1, date: '2026-06-19' },
];

// ─── AMA Sessions ────────────────────────────────────────
export const amaSessions: AMASession[] = [
  { id: 'ama1', memberId: 'u3', date: '2026-06-19', teaserQuestions: ['What is your creative process?', 'How do you handle feedback?', 'Tips for aspiring creative directors?'], archived: false },
  { id: 'ama2', memberId: 'u2', date: '2026-06-12', teaserQuestions: ['Best debugging tips?', 'How do you stay current with tech?'], archived: true },
  { id: 'ama3', memberId: 'u5', date: '2026-06-05', teaserQuestions: ['Favourite design tools?', 'How to balance aesthetics and usability?'], archived: true },
  { id: 'ama4', memberId: 'u6', date: '2026-05-29', teaserQuestions: ['What is DesignOps?', 'How to scale design systems?'], archived: true },
];

// ─── Focus Sessions ──────────────────────────────────────
export const focusSessions: FocusSession[] = [
  { id: 'fs1', hostId: 'u2', participants: ['u2', 'u6'], timeRemaining: 18, totalTime: 25, isActive: true },
  { id: 'fs2', hostId: 'u3', participants: ['u3'], timeRemaining: 12, totalTime: 25, isActive: true },
];

// ─── Notifications ───────────────────────────────────────
export const notifications: Notification[] = [
  { id: 'n1', type: 'message', title: 'Jake challenged you', body: 'to a Memory Match game!', read: false, timestamp: '2026-06-19T11:00:00Z' },
  { id: 'n2', type: 'alert', title: 'New AMA today', body: 'Sarah is answering questions at 3 PM', read: false, timestamp: '2026-06-19T09:00:00Z' },
  { id: 'n3', type: 'invite', title: 'Focus session invite', body: 'Alex started a group Pomodoro', read: true, timestamp: '2026-06-19T08:30:00Z' },
];

// ─── Lounge Tiles ────────────────────────────────────────
export const chillTiles: LoungeTile[] = [
  { id: 'ct1', title: 'Games', description: 'Solo & head-to-head fun', icon: 'Gamepad2', route: '/chill/games', stat: '42 plays today', color: 'bg-orange-500/20 text-orange-300' },
  { id: 'ct2', title: 'Music', description: 'Team playlists & discovery', icon: 'Music', route: '/chill/music', stat: '6 listening now', color: 'bg-pink-500/20 text-pink-300' },
  { id: 'ct3', title: 'Collaborative Canvas', description: 'Draw together in real-time', icon: 'Palette', route: '/chill/canvas', stat: '3 drawing now', color: 'bg-violet-500/20 text-violet-300' },
  { id: 'ct4', title: 'Desk Pets', description: 'Care for your digital companion', icon: 'Heart', route: '/chill/pets', stat: 'Level up ready', color: 'bg-emerald-500/20 text-emerald-300' },
  { id: 'ct5', title: 'Meme Wall', description: 'Pin your favourites', icon: 'Image', route: '/chill/memes', stat: '6 new today', color: 'bg-yellow-500/20 text-yellow-300' },
];

export const learnTiles: LoungeTile[] = [
  { id: 'lt1', title: 'Mini-Courses', description: 'Bite-sized skill building', icon: 'GraduationCap', route: '/learn/courses', stat: '6 available', color: 'bg-teal-500/20 text-teal-300' },
  { id: 'lt2', title: 'Skill Swap', description: 'Teach and learn from the team', icon: 'ArrowLeftRight', route: '/learn/skill-swap', stat: '6 active posts', color: 'bg-cyan-500/20 text-cyan-300' },
  { id: 'lt3', title: 'Brain Teaser', description: 'Daily puzzle leaderboard', icon: 'Trophy', route: '/learn/leaderboard', stat: 'Solve today\'s puzzle', color: 'bg-amber-500/20 text-amber-300' },
  { id: 'lt4', title: 'AMA Archive', description: 'Ask Me Anything sessions', icon: 'MessageCircle', route: '/learn/ama', stat: 'Sarah spotlight today', color: 'bg-rose-500/20 text-rose-300' },
];

// ─── Helper functions ────────────────────────────────────
export function getUserById(id: string): User | undefined {
  return users.find(u => u.id === id);
}

export function getPetById(id: string): DeskPet | undefined {
  return deskPets.find(p => p.id === id);
}

export function getUserPet(userId: string): DeskPet | undefined {
  return deskPets.find(p => p.ownerId === userId);
}
