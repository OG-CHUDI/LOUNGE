-- ============================================================
-- Airwaves › The Pod — shows, episodes, reactions, comments,
-- follows and per-user listening progress.
-- Run after 015. Safe to re-run (idempotent). Reuses the
-- existing public 'airwaves' storage bucket for audio + covers.
-- ============================================================

-- ── Shows ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_shows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  cover_url   text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pod_shows_created_idx ON pod_shows (created_at DESC);

ALTER TABLE pod_shows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read shows" ON pod_shows;
CREATE POLICY "Anyone can read shows" ON pod_shows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create shows" ON pod_shows;
CREATE POLICY "Users can create shows" ON pod_shows FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can update shows" ON pod_shows;
CREATE POLICY "Owners can update shows" ON pod_shows FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners can delete shows" ON pod_shows;
CREATE POLICY "Owners can delete shows" ON pod_shows FOR DELETE USING (auth.uid() = owner_id);

-- ── Episodes (only a show's owner may publish to it) ─────────
CREATE TABLE IF NOT EXISTS pod_episodes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id          uuid NOT NULL REFERENCES pod_shows(id) ON DELETE CASCADE,
  author_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  audio_url        text NOT NULL,
  duration_seconds integer,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pod_episodes_show_idx ON pod_episodes (show_id, created_at DESC);

ALTER TABLE pod_episodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read episodes" ON pod_episodes;
CREATE POLICY "Anyone can read episodes" ON pod_episodes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Show owners can publish episodes" ON pod_episodes;
CREATE POLICY "Show owners can publish episodes" ON pod_episodes FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM pod_shows s WHERE s.id = show_id AND s.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Authors can delete own episodes" ON pod_episodes;
CREATE POLICY "Authors can delete own episodes" ON pod_episodes FOR DELETE USING (auth.uid() = author_id);

-- ── Reactions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_episode_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES pod_episodes(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji      text NOT NULL,
  UNIQUE (episode_id, user_id, emoji)
);

ALTER TABLE pod_episode_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read episode reactions" ON pod_episode_reactions;
CREATE POLICY "Anyone can read episode reactions" ON pod_episode_reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users add own episode reactions" ON pod_episode_reactions;
CREATE POLICY "Users add own episode reactions" ON pod_episode_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users remove own episode reactions" ON pod_episode_reactions;
CREATE POLICY "Users remove own episode reactions" ON pod_episode_reactions FOR DELETE USING (auth.uid() = user_id);

-- ── Comments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_episode_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES pod_episodes(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pod_episode_comments_ep_idx ON pod_episode_comments (episode_id, created_at);

ALTER TABLE pod_episode_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read episode comments" ON pod_episode_comments;
CREATE POLICY "Anyone can read episode comments" ON pod_episode_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert episode comments" ON pod_episode_comments;
CREATE POLICY "Users insert episode comments" ON pod_episode_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own episode comments" ON pod_episode_comments;
CREATE POLICY "Users delete own episode comments" ON pod_episode_comments FOR DELETE USING (auth.uid() = user_id);

-- ── Follows ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pod_follows (
  show_id    uuid NOT NULL REFERENCES pod_shows(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (show_id, user_id)
);

ALTER TABLE pod_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read follows" ON pod_follows;
CREATE POLICY "Anyone can read follows" ON pod_follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users follow shows" ON pod_follows;
CREATE POLICY "Users follow shows" ON pod_follows FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users unfollow shows" ON pod_follows;
CREATE POLICY "Users unfollow shows" ON pod_follows FOR DELETE USING (auth.uid() = user_id);

-- ── Listening progress (continue where you left off) ────────
CREATE TABLE IF NOT EXISTS pod_progress (
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  episode_id       uuid NOT NULL REFERENCES pod_episodes(id) ON DELETE CASCADE,
  position_seconds integer DEFAULT 0,
  updated_at       timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, episode_id)
);

ALTER TABLE pod_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own progress" ON pod_progress;
CREATE POLICY "Users read own progress" ON pod_progress FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users write own progress" ON pod_progress;
CREATE POLICY "Users write own progress" ON pod_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own progress" ON pod_progress;
CREATE POLICY "Users update own progress" ON pod_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Realtime ────────────────────────────────────────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE pod_shows; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE pod_episodes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE pod_episode_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE pod_episode_comments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE pod_follows; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
