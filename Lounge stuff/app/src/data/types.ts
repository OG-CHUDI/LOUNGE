// Lounge Data Types
// TODO: These types map to backend API schemas. Update when backend is connected.

export interface User {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'online' | 'away' | 'focus' | 'offline';
  currentTrack?: string;
  petId?: string;
}

export interface DeskPet {
  id: string;
  name: string;
  image: string;
  stage: 'egg' | 'baby' | 'teen' | 'adult' | 'sage';
  xp: number;
  maxXp: number;
  ownerId: string;
  customizations: {
    hat?: string;
    accessory?: string;
    aura?: string;
  };
}

export interface MemePin {
  id: string;
  imageUrl: string;
  caption: string;
  posterId: string;
  reactions: Record<string, number>;
  timestamp: string;
}

export interface Game {
  id: string;
  title: string;
  cover: string;
  category: 'solo' | 'head-to-head';
  avgPlayTime: string;
  description: string;
  status: 'live' | 'coming-soon';
  playersToday: number;
}

export interface Playlist {
  id: string;
  title: string;
  cover: string;
  curatorId: string;
  spotifyUrl: string;
  trackCount: number;
}

export interface Course {
  id: string;
  title: string;
  cover: string;
  duration: string;
  category: string;
  progress: number;
  instructor: string;
  lessons: number;
}

export interface SkillSwap {
  id: string;
  type: 'offering' | 'seeking';
  userId: string;
  skill: string;
  blurb: string;
  tags: string[];
  timestamp: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  solveTime: string;
  streak: number;
  date: string;
}

export interface AMASession {
  id: string;
  memberId: string;
  date: string;
  teaserQuestions: string[];
  archived: boolean;
}

export interface FocusSession {
  id: string;
  hostId: string;
  participants: string[];
  timeRemaining: number;
  totalTime: number;
  isActive: boolean;
}

export interface Notification {
  id: string;
  type: 'message' | 'alert' | 'invite';
  title: string;
  body: string;
  read: boolean;
  timestamp: string;
}

export interface LoungeTile {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  stat: string;
  color: string;
}
