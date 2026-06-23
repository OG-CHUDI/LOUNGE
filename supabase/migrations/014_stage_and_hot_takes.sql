-- ============================================================
-- Lounge: The Stage (Learning) + Hot Takes (Chill)
-- Run after prior migrations. Safe to re-run (idempotent).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- HOT TAKES (Chill) — open board: post a take, vote agree/disagree, comment
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hot_takes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hot_takes_created_idx ON hot_takes (created_at DESC);

ALTER TABLE hot_takes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read hot takes" ON hot_takes;
CREATE POLICY "Anyone can read hot takes" ON hot_takes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can post hot takes" ON hot_takes;
CREATE POLICY "Users can post hot takes" ON hot_takes FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete own hot takes" ON hot_takes;
CREATE POLICY "Users can delete own hot takes" ON hot_takes FOR DELETE USING (auth.uid() = author_id);

CREATE TABLE IF NOT EXISTS hot_take_votes (
  take_id    uuid NOT NULL REFERENCES hot_takes(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote       text NOT NULL CHECK (vote IN ('agree', 'disagree')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (take_id, user_id)
);

ALTER TABLE hot_take_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read hot take votes" ON hot_take_votes;
CREATE POLICY "Anyone can read hot take votes" ON hot_take_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can cast own hot take votes" ON hot_take_votes;
CREATE POLICY "Users can cast own hot take votes" ON hot_take_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can change own hot take votes" ON hot_take_votes;
CREATE POLICY "Users can change own hot take votes" ON hot_take_votes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove own hot take votes" ON hot_take_votes;
CREATE POLICY "Users can remove own hot take votes" ON hot_take_votes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS hot_take_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  take_id    uuid NOT NULL REFERENCES hot_takes(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hot_take_comments_take_idx ON hot_take_comments (take_id, created_at);

ALTER TABLE hot_take_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read hot take comments" ON hot_take_comments;
CREATE POLICY "Anyone can read hot take comments" ON hot_take_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert hot take comments" ON hot_take_comments;
CREATE POLICY "Users can insert hot take comments" ON hot_take_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own hot take comments" ON hot_take_comments;
CREATE POLICY "Users can delete own hot take comments" ON hot_take_comments FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- THE STAGE (Learning) — showcase posts + reactions + comments + demo slots
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stage_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  link_url    text,
  image_url   text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stage_posts_created_idx ON stage_posts (created_at DESC);

ALTER TABLE stage_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read stage posts" ON stage_posts;
CREATE POLICY "Anyone can read stage posts" ON stage_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create stage posts" ON stage_posts;
CREATE POLICY "Users can create stage posts" ON stage_posts FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete own stage posts" ON stage_posts;
CREATE POLICY "Users can delete own stage posts" ON stage_posts FOR DELETE USING (auth.uid() = author_id);

CREATE TABLE IF NOT EXISTS stage_reactions (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES stage_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji   text NOT NULL,
  UNIQUE (post_id, user_id, emoji)
);

ALTER TABLE stage_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read stage reactions" ON stage_reactions;
CREATE POLICY "Anyone can read stage reactions" ON stage_reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can add own stage reactions" ON stage_reactions;
CREATE POLICY "Users can add own stage reactions" ON stage_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove own stage reactions" ON stage_reactions;
CREATE POLICY "Users can remove own stage reactions" ON stage_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS stage_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES stage_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stage_comments_post_idx ON stage_comments (post_id, created_at);

ALTER TABLE stage_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read stage comments" ON stage_comments;
CREATE POLICY "Anyone can read stage comments" ON stage_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert stage comments" ON stage_comments;
CREATE POLICY "Users can insert stage comments" ON stage_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own stage comments" ON stage_comments;
CREATE POLICY "Users can delete own stage comments" ON stage_comments FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS stage_demo_slots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  notes        text,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stage_demo_slots_when_idx ON stage_demo_slots (scheduled_at);

ALTER TABLE stage_demo_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read demo slots" ON stage_demo_slots;
CREATE POLICY "Anyone can read demo slots" ON stage_demo_slots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can claim demo slots" ON stage_demo_slots;
CREATE POLICY "Users can claim demo slots" ON stage_demo_slots FOR INSERT WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Users can update own demo slots" ON stage_demo_slots;
CREATE POLICY "Users can update own demo slots" ON stage_demo_slots FOR UPDATE USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Users can delete own demo slots" ON stage_demo_slots;
CREATE POLICY "Users can delete own demo slots" ON stage_demo_slots FOR DELETE USING (auth.uid() = host_id);

-- ────────────────────────────────────────────────────────────
-- STORAGE — images for stage posts
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('stage', 'stage', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read stage" ON storage.objects;
CREATE POLICY "Public read stage" ON storage.objects FOR SELECT USING (bucket_id = 'stage');

DROP POLICY IF EXISTS "Auth upload stage" ON storage.objects;
CREATE POLICY "Auth upload stage" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'stage' AND auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- REALTIME — publish the new tables for live updates
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE hot_takes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE hot_take_votes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE hot_take_comments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE stage_posts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE stage_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE stage_comments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE stage_demo_slots; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
