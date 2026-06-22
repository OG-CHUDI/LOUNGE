-- ============================================================
-- Lounge: Feature Migration (Pets, Games, Canvas, Meme Walls)
-- Run after 001 + 002. Safe to re-run (idempotent).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. DESK PETS — feeding, happiness, species, customisation
-- ────────────────────────────────────────────────────────────
ALTER TABLE desk_pets
  ADD COLUMN IF NOT EXISTS species    text    DEFAULT 'chick',
  ADD COLUMN IF NOT EXISTS pet_name   text,
  ADD COLUMN IF NOT EXISTS happiness  integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS fed_on     date,
  ADD COLUMN IF NOT EXISTS adopted_on date    DEFAULT CURRENT_DATE;

-- Backfill adopted_on for any pets created before this migration
UPDATE desk_pets
SET adopted_on = COALESCE(adopted_on, created_at::date, CURRENT_DATE)
WHERE adopted_on IS NULL;

-- ────────────────────────────────────────────────────────────
-- 2. GAME SCORES — one leaderboard table for every game.
--    Convention: higher score is always better. Time-based
--    games store a normalised score (see src/lib/games.ts).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_scores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_key   text NOT NULL,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score      integer NOT NULL,
  detail     jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_scores_game_idx ON game_scores (game_key, score DESC);

ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read game scores" ON game_scores;
CREATE POLICY "Anyone can read game scores"
  ON game_scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own scores" ON game_scores;
CREATE POLICY "Users can insert own scores"
  ON game_scores FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Seed the full game catalogue (stable ids; reused by matchmaking).
INSERT INTO games (id, title, mode, avg_minutes) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Memory Match',  'solo',        3),
  ('a0000000-0000-0000-0000-000000000002', 'Number Slide',  'solo',        5),
  ('a0000000-0000-0000-0000-000000000004', 'Reaction Rush', 'solo',        2),
  ('a0000000-0000-0000-0000-000000000005', 'Word Scramble', 'solo',        4),
  ('a0000000-0000-0000-0000-000000000006', 'Word Link',     'head_to_head', 5),
  ('a0000000-0000-0000-0000-000000000007', 'Sketch Rush',   'head_to_head', 6),
  ('a0000000-0000-0000-0000-000000000008', 'Tic-Tac-Toe',   'head_to_head', 3)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, mode = EXCLUDED.mode, avg_minutes = EXCLUDED.avg_minutes;

-- Old seed row 'Number Puzzle' / 'Code Golf' tidy-up (renamed above where ids match).
UPDATE games SET title = 'Number Slide' WHERE id = 'a0000000-0000-0000-0000-000000000002';

-- ────────────────────────────────────────────────────────────
-- 3. COLLABORATIVE CANVAS — ownership + invites
-- ────────────────────────────────────────────────────────────
ALTER TABLE canvas_boards
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS canvas_members (
  board_id   uuid NOT NULL REFERENCES canvas_boards(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     text DEFAULT 'invited',          -- invited | accepted | declined
  invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);

ALTER TABLE canvas_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read canvas members" ON canvas_members;
CREATE POLICY "Anyone can read canvas members"
  ON canvas_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can add canvas members" ON canvas_members;
CREATE POLICY "Authenticated can add canvas members"
  ON canvas_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users update own canvas membership" ON canvas_members;
CREATE POLICY "Users update own canvas membership"
  ON canvas_members FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = invited_by)
  WITH CHECK (true);

-- Let owners set/clear board creator on insert.
DROP POLICY IF EXISTS "Authenticated users can insert canvas boards" ON canvas_boards;
CREATE POLICY "Authenticated users can insert canvas boards"
  ON canvas_boards FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 4. MEME WALLS — multiple walls, invites, comments
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meme_walls (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meme_walls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read meme walls" ON meme_walls;
CREATE POLICY "Anyone can read meme walls"
  ON meme_walls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can create meme walls" ON meme_walls;
CREATE POLICY "Authenticated can create meme walls"
  ON meme_walls FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE TABLE IF NOT EXISTS meme_wall_members (
  wall_id    uuid NOT NULL REFERENCES meme_walls(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     text DEFAULT 'invited',          -- invited | accepted | declined
  invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (wall_id, user_id)
);

ALTER TABLE meme_wall_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read meme wall members" ON meme_wall_members;
CREATE POLICY "Anyone can read meme wall members"
  ON meme_wall_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can add meme wall members" ON meme_wall_members;
CREATE POLICY "Authenticated can add meme wall members"
  ON meme_wall_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users update own meme wall membership" ON meme_wall_members;
CREATE POLICY "Users update own meme wall membership"
  ON meme_wall_members FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = invited_by)
  WITH CHECK (true);

-- Memes now belong to a wall and carry a caption.
ALTER TABLE memes
  ADD COLUMN IF NOT EXISTS wall_id uuid REFERENCES meme_walls(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS caption text;

CREATE INDEX IF NOT EXISTS memes_wall_idx ON memes (wall_id, created_at DESC);

-- Meme comments
CREATE TABLE IF NOT EXISTS meme_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meme_id    uuid NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meme_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read meme comments" ON meme_comments;
CREATE POLICY "Anyone can read meme comments"
  ON meme_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert meme comments" ON meme_comments;
CREATE POLICY "Users can insert meme comments"
  ON meme_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own meme comments" ON meme_comments;
CREATE POLICY "Users can delete own meme comments"
  ON meme_comments FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 5. STORAGE BUCKETS — pet PFPs + meme images
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('memes', 'memes', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Auth upload avatars" ON storage.objects;
CREATE POLICY "Auth upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth update avatars" ON storage.objects;
CREATE POLICY "Auth update avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public read memes" ON storage.objects;
CREATE POLICY "Public read memes"
  ON storage.objects FOR SELECT USING (bucket_id = 'memes');

DROP POLICY IF EXISTS "Auth upload memes" ON storage.objects;
CREATE POLICY "Auth upload memes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'memes' AND auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 6. REALTIME — publish tables used for live collaboration
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE game_matches;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE canvas_boards;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE canvas_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE memes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE meme_comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE meme_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE meme_wall_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
