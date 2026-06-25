-- ============================================================
-- Airwaves › Audio Charades + Open Verse
-- Run after 016. Idempotent. Reuses the public 'airwaves' bucket.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- AUDIO CHARADES — record a clue describing a word (without saying
-- it); others guess. The answer is kept in a separate table that no
-- one can read directly; guessing/creating/revealing go through
-- SECURITY DEFINER functions so the answer can't be sniffed.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS charades_rounds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clue_audio_url  text NOT NULL,
  revealed_answer text,                       -- populated only once solved/revealed
  solved_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  solved_at       timestamptz,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS charades_rounds_created_idx ON charades_rounds (created_at DESC);

ALTER TABLE charades_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read charades" ON charades_rounds;
CREATE POLICY "Anyone can read charades" ON charades_rounds FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authors can delete own charades" ON charades_rounds;
CREATE POLICY "Authors can delete own charades" ON charades_rounds FOR DELETE USING (auth.uid() = author_id);
-- (inserts/updates go through the functions below, which run as definer)

-- Secret answers — RLS on, no policies → unreadable via the API.
CREATE TABLE IF NOT EXISTS charades_secrets (
  round_id uuid PRIMARY KEY REFERENCES charades_rounds(id) ON DELETE CASCADE,
  answer   text NOT NULL
);
ALTER TABLE charades_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS charades_guesses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id   uuid NOT NULL REFERENCES charades_rounds(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guess      text NOT NULL,
  correct    boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS charades_guesses_round_idx ON charades_guesses (round_id, created_at);

ALTER TABLE charades_guesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read guesses" ON charades_guesses;
CREATE POLICY "Anyone can read guesses" ON charades_guesses FOR SELECT USING (true);
-- (inserts go through submit_charade_guess, which runs as definer)

-- Create a round + stash its secret answer.
CREATE OR REPLACE FUNCTION create_charade(p_clue_audio_url text, p_answer text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF btrim(coalesce(p_answer, '')) = '' THEN RAISE EXCEPTION 'Answer required'; END IF;
  INSERT INTO charades_rounds (author_id, clue_audio_url) VALUES (auth.uid(), p_clue_audio_url) RETURNING id INTO new_id;
  INSERT INTO charades_secrets (round_id, answer) VALUES (new_id, btrim(p_answer));
  RETURN new_id;
END; $$;
GRANT EXECUTE ON FUNCTION create_charade(text, text) TO authenticated;

-- Submit a guess; grades server-side, solves the round on first correct guess.
CREATE OR REPLACE FUNCTION submit_charade_guess(p_round uuid, p_guess text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_answer text; v_correct boolean; v_solved uuid; v_revealed text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT answer INTO v_answer FROM charades_secrets WHERE round_id = p_round;
  IF v_answer IS NULL THEN RAISE EXCEPTION 'Round not found'; END IF;
  SELECT solved_by INTO v_solved FROM charades_rounds WHERE id = p_round;
  v_correct := lower(btrim(p_guess)) = lower(btrim(v_answer));
  INSERT INTO charades_guesses (round_id, user_id, guess, correct) VALUES (p_round, auth.uid(), p_guess, v_correct);
  IF v_correct AND v_solved IS NULL THEN
    UPDATE charades_rounds SET solved_by = auth.uid(), solved_at = now(), revealed_answer = v_answer
    WHERE id = p_round AND solved_by IS NULL;
  END IF;
  SELECT revealed_answer INTO v_revealed FROM charades_rounds WHERE id = p_round;
  RETURN jsonb_build_object('correct', v_correct, 'revealed', v_revealed);
END; $$;
GRANT EXECUTE ON FUNCTION submit_charade_guess(uuid, text) TO authenticated;

-- Author gives up → reveal the answer to everyone.
CREATE OR REPLACE FUNCTION reveal_charade(p_round uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_answer text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM charades_rounds WHERE id = p_round AND author_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the author can reveal';
  END IF;
  SELECT answer INTO v_answer FROM charades_secrets WHERE round_id = p_round;
  UPDATE charades_rounds SET revealed_answer = v_answer WHERE id = p_round;
  RETURN v_answer;
END; $$;
GRANT EXECUTE ON FUNCTION reveal_charade(uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- OPEN VERSE — collaborative audio: a track built line-by-line,
-- each contributor adding one clip in turn.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS openverse_tracks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  author_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS openverse_tracks_created_idx ON openverse_tracks (created_at DESC);

ALTER TABLE openverse_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read tracks" ON openverse_tracks;
CREATE POLICY "Anyone can read tracks" ON openverse_tracks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create tracks" ON openverse_tracks;
CREATE POLICY "Users can create tracks" ON openverse_tracks FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can delete own tracks" ON openverse_tracks;
CREATE POLICY "Authors can delete own tracks" ON openverse_tracks FOR DELETE USING (auth.uid() = author_id);

CREATE TABLE IF NOT EXISTS openverse_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id         uuid NOT NULL REFERENCES openverse_tracks(id) ON DELETE CASCADE,
  author_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  audio_url        text NOT NULL,
  duration_seconds integer,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS openverse_lines_track_idx ON openverse_lines (track_id, created_at);

ALTER TABLE openverse_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read lines" ON openverse_lines;
CREATE POLICY "Anyone can read lines" ON openverse_lines FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can add lines" ON openverse_lines;
CREATE POLICY "Users can add lines" ON openverse_lines FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can delete own lines" ON openverse_lines;
CREATE POLICY "Authors can delete own lines" ON openverse_lines FOR DELETE USING (auth.uid() = author_id);

-- ── Realtime ────────────────────────────────────────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE charades_rounds; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE charades_guesses; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE openverse_tracks; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE openverse_lines; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
