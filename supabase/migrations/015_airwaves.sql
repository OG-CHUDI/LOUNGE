-- ============================================================
-- Airwaves Lounge — voice notes, soundboard, name tags
-- Run after prior migrations. Safe to re-run (idempotent).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- VOICE NOTES — async audio feed with reactions + comments
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_notes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  audio_url        text NOT NULL,
  caption          text,
  duration_seconds integer,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_notes_created_idx ON voice_notes (created_at DESC);

ALTER TABLE voice_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read voice notes" ON voice_notes;
CREATE POLICY "Anyone can read voice notes" ON voice_notes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can post voice notes" ON voice_notes;
CREATE POLICY "Users can post voice notes" ON voice_notes FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete own voice notes" ON voice_notes;
CREATE POLICY "Users can delete own voice notes" ON voice_notes FOR DELETE USING (auth.uid() = author_id);

CREATE TABLE IF NOT EXISTS voice_note_reactions (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES voice_notes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji   text NOT NULL,
  UNIQUE (note_id, user_id, emoji)
);

ALTER TABLE voice_note_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read voice note reactions" ON voice_note_reactions;
CREATE POLICY "Anyone can read voice note reactions" ON voice_note_reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can add own voice note reactions" ON voice_note_reactions;
CREATE POLICY "Users can add own voice note reactions" ON voice_note_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove own voice note reactions" ON voice_note_reactions;
CREATE POLICY "Users can remove own voice note reactions" ON voice_note_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS voice_note_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id    uuid NOT NULL REFERENCES voice_notes(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_note_comments_note_idx ON voice_note_comments (note_id, created_at);

ALTER TABLE voice_note_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read voice note comments" ON voice_note_comments;
CREATE POLICY "Anyone can read voice note comments" ON voice_note_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert voice note comments" ON voice_note_comments;
CREATE POLICY "Users can insert voice note comments" ON voice_note_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own voice note comments" ON voice_note_comments;
CREATE POLICY "Users can delete own voice note comments" ON voice_note_comments FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- STORAGE — audio for the whole lounge
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('airwaves', 'airwaves', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read airwaves" ON storage.objects;
CREATE POLICY "Public read airwaves" ON storage.objects FOR SELECT USING (bucket_id = 'airwaves');

DROP POLICY IF EXISTS "Auth upload airwaves" ON storage.objects;
CREATE POLICY "Auth upload airwaves" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'airwaves' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Auth update airwaves" ON storage.objects;
CREATE POLICY "Auth update airwaves" ON storage.objects FOR UPDATE
  USING (bucket_id = 'airwaves' AND auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- REALTIME
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE voice_notes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE voice_note_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE voice_note_comments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
