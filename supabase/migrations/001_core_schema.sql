-- ============================================================
-- Lounge: Core Schema Migration
-- Run this on a fresh Supabase project to create all tables,
-- RLS policies, and the profile auto-create trigger.
-- ============================================================

-- Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  role text DEFAULT 'Team Member',
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read profiles"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create profile row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Desk Pets
CREATE TABLE IF NOT EXISTS desk_pets (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  stage text DEFAULT 'egg',
  xp integer DEFAULT 0,
  streak integer DEFAULT 0,
  last_active_on date DEFAULT CURRENT_DATE,
  accessories jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE desk_pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read desk pets"
  ON desk_pets FOR SELECT USING (true);

CREATE POLICY "Users can insert own desk pet"
  ON desk_pets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own desk pet"
  ON desk_pets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Games
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('solo', 'head_to_head')),
  cover_url text,
  avg_minutes integer DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read games"
  ON games FOR SELECT USING (true);

-- Game Matches
CREATE TABLE IF NOT EXISTS game_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id),
  host_id uuid NOT NULL REFERENCES profiles(id),
  opponent_id uuid REFERENCES profiles(id),
  state jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'waiting',
  score jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE game_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read game matches"
  ON game_matches FOR SELECT USING (true);

CREATE POLICY "Users can create matches"
  ON game_matches FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Participants can update matches"
  ON game_matches FOR UPDATE
  USING (auth.uid() IN (host_id, opponent_id))
  WITH CHECK (auth.uid() IN (host_id, opponent_id));

-- Playlists
CREATE TABLE IF NOT EXISTS playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  spotify_url text NOT NULL,
  cover_url text,
  curator_id uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read playlists"
  ON playlists FOR SELECT USING (true);

CREATE POLICY "Users can insert playlists"
  ON playlists FOR INSERT
  WITH CHECK (auth.uid() = curator_id);

CREATE POLICY "Curators can update their playlists"
  ON playlists FOR UPDATE
  USING (auth.uid() = curator_id)
  WITH CHECK (auth.uid() = curator_id);

-- Listening Now
CREATE TABLE IF NOT EXISTS listening_now (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  track_title text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE listening_now ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read listening now"
  ON listening_now FOR SELECT USING (true);

CREATE POLICY "Users can upsert own listening"
  ON listening_now FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own listening"
  ON listening_now FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Canvas Boards
CREATE TABLE IF NOT EXISTS canvas_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  snapshot jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE canvas_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read canvas boards"
  ON canvas_boards FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert canvas boards"
  ON canvas_boards FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update canvas boards"
  ON canvas_boards FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Memes
CREATE TABLE IF NOT EXISTS memes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  poster_id uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE memes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read memes"
  ON memes FOR SELECT USING (true);

CREATE POLICY "Users can insert memes"
  ON memes FOR INSERT
  WITH CHECK (auth.uid() = poster_id);

CREATE POLICY "Posters can delete own memes"
  ON memes FOR DELETE
  USING (auth.uid() = poster_id);

-- Meme Reactions
CREATE TABLE IF NOT EXISTS meme_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meme_id uuid NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(meme_id, user_id, emoji)
);

ALTER TABLE meme_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read meme reactions"
  ON meme_reactions FOR SELECT USING (true);

CREATE POLICY "Users can insert reactions"
  ON meme_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
  ON meme_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  cover_url text,
  duration_minutes integer DEFAULT 15,
  category text DEFAULT 'General',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read courses"
  ON courses FOR SELECT USING (true);

-- Course Progress
CREATE TABLE IF NOT EXISTS course_progress (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  percent integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read course progress"
  ON course_progress FOR SELECT USING (true);

CREATE POLICY "Users can upsert own progress"
  ON course_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON course_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Skill Swaps
CREATE TABLE IF NOT EXISTS skill_swaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('offering', 'seeking')),
  skill text NOT NULL,
  blurb text,
  author_id uuid NOT NULL REFERENCES profiles(id),
  tags text[] DEFAULT '{}'::text[],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE skill_swaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read skill swaps"
  ON skill_swaps FOR SELECT USING (true);

CREATE POLICY "Users can insert skill swaps"
  ON skill_swaps FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their swaps"
  ON skill_swaps FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Brain Teasers
CREATE TABLE IF NOT EXISTS brain_teasers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  prompt text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE brain_teasers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read brain teasers"
  ON brain_teasers FOR SELECT USING (true);

-- Leaderboard Entries
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teaser_id uuid NOT NULL REFERENCES brain_teasers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  solve_seconds integer NOT NULL,
  solved_at timestamptz DEFAULT now()
);

ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read leaderboard"
  ON leaderboard_entries FOR SELECT USING (true);

CREATE POLICY "Users can insert entries"
  ON leaderboard_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- AMAs
CREATE TABLE IF NOT EXISTS amas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotlight_user_id uuid NOT NULL REFERENCES profiles(id),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE amas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read AMAs"
  ON amas FOR SELECT USING (true);

-- AMA Questions
CREATE TABLE IF NOT EXISTS ama_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ama_id uuid NOT NULL REFERENCES amas(id) ON DELETE CASCADE,
  asker_id uuid NOT NULL REFERENCES profiles(id),
  question text NOT NULL,
  answer text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ama_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read AMA questions"
  ON ama_questions FOR SELECT USING (true);

CREATE POLICY "Users can ask questions"
  ON ama_questions FOR INSERT
  WITH CHECK (auth.uid() = asker_id);

CREATE POLICY "Spotlight user can answer"
  ON ama_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM amas
      WHERE amas.id = ama_questions.ama_id
      AND amas.spotlight_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM amas
      WHERE amas.id = ama_questions.ama_id
      AND amas.spotlight_user_id = auth.uid()
    )
  );

-- Pomodoro Sessions
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES profiles(id),
  phase text NOT NULL CHECK (phase IN ('work', 'break')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  status text DEFAULT 'active'
);

ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pomodoro sessions"
  ON pomodoro_sessions FOR SELECT USING (true);

CREATE POLICY "Users can create sessions"
  ON pomodoro_sessions FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update sessions"
  ON pomodoro_sessions FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- Pomodoro Participants
CREATE TABLE IF NOT EXISTS pomodoro_participants (
  session_id uuid NOT NULL REFERENCES pomodoro_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, user_id)
);

ALTER TABLE pomodoro_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read participants"
  ON pomodoro_participants FOR SELECT USING (true);

CREATE POLICY "Users can join sessions"
  ON pomodoro_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Focus Status
CREATE TABLE IF NOT EXISTS focus_status (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_focusing boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE focus_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read focus status"
  ON focus_status FOR SELECT USING (true);

CREATE POLICY "Users can insert focus status"
  ON focus_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own focus status"
  ON focus_status FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
