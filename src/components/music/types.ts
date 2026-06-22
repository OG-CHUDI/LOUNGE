export interface CuratorRef {
  name: string | null;
  avatar_url: string | null;
}

export interface PlaylistRow {
  id: string;
  title: string;
  spotify_url: string;
  cover_url: string | null;
  curator_id: string;
  created_at: string;
  curator: CuratorRef | null;
}

export interface ListenerRef {
  name: string | null;
  avatar_url: string | null;
}

export interface ListeningRow {
  user_id: string;
  track_title: string | null;
  updated_at: string;
  user: ListenerRef | null;
}
