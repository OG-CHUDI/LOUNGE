-- ============================================================
-- Lounge: server-side authority for secrets + collaborative canvas.
-- Fixes: Imposter/Sketch secret leakage (secrets now live in a table no
-- client can read, exposed only via SECURITY DEFINER RPCs), Imposter
-- persistence + host-disconnect (state persisted via RPC any participant can
-- call), and canvas last-writer-wins (append-only stroke rows).
-- Run after 004. Safe to re-run.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECRETS — readable ONLY through the functions below (RLS on, no policies).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_secrets (
  match_id   uuid PRIMARY KEY REFERENCES game_matches(id) ON DELETE CASCADE,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  revealed   boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE match_secrets ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies: clients cannot SELECT/INSERT/UPDATE this table
-- directly. Only the SECURITY DEFINER functions below may touch it.

CREATE OR REPLACE FUNCTION is_member(p_players jsonb)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(COALESCE(p_players, '[]'::jsonb)) e
    WHERE e = auth.uid()::text
  );
$$;

-- ── IMPOSTER ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION imposter_deal(p_match uuid, p_players uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_host uuid;
  v_words text[] := ARRAY['Beach','Library','Hospital','Airport','Castle','Volcano','Submarine','Circus','Bakery','Museum','Stadium','Jungle','Desert','Spaceship','Lighthouse','Aquarium','Vineyard','Glacier','Pyramid','Waterfall','Carnival','Observatory','Greenhouse','Harbour','Cathedral','Windmill','Treehouse','Igloo','Saloon','Laboratory','Orchard','Marketplace','Temple','Canyon','Reef','Tundra','Bazaar','Cottage','Arena','Studio'];
  v_word text;
  v_imp uuid;
BEGIN
  SELECT host_id INTO v_host FROM game_matches WHERE id = p_match;
  IF v_host IS NULL OR v_host <> auth.uid() THEN RAISE EXCEPTION 'only host can deal'; END IF;
  IF array_length(p_players, 1) IS NULL OR array_length(p_players, 1) < 3 THEN
    RAISE EXCEPTION 'need at least 3 players';
  END IF;
  v_word := v_words[1 + floor(random() * array_length(v_words, 1))::int];
  v_imp  := p_players[1 + floor(random() * array_length(p_players, 1))::int];
  INSERT INTO match_secrets (match_id, data, revealed, updated_at)
  VALUES (p_match, jsonb_build_object('word', v_word, 'imposter', v_imp, 'players', to_jsonb(p_players)), false, now())
  ON CONFLICT (match_id) DO UPDATE SET data = EXCLUDED.data, revealed = false, updated_at = now();
END; $$;

-- Returns ONLY the caller's own role (+ word if crew). Imposter never learns the word.
CREATE OR REPLACE FUNCTION imposter_my_role(p_match uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_data jsonb;
BEGIN
  SELECT data INTO v_data FROM match_secrets WHERE match_id = p_match;
  IF v_data IS NULL THEN RETURN NULL; END IF;
  IF NOT is_member(v_data->'players') THEN RAISE EXCEPTION 'not a participant'; END IF;
  IF (v_data->>'imposter')::uuid = auth.uid() THEN
    RETURN jsonb_build_object('role', 'imposter', 'word', NULL);
  END IF;
  RETURN jsonb_build_object('role', 'crew', 'word', v_data->>'word');
END; $$;

CREATE OR REPLACE FUNCTION imposter_reveal_now(p_match uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_host uuid;
BEGIN
  SELECT host_id INTO v_host FROM game_matches WHERE id = p_match;
  IF v_host <> auth.uid() THEN RAISE EXCEPTION 'only host'; END IF;
  UPDATE match_secrets SET revealed = true, updated_at = now() WHERE match_id = p_match;
END; $$;

-- Full truth, but only after the host has revealed.
CREATE OR REPLACE FUNCTION imposter_truth(p_match uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_data jsonb; v_rev boolean;
BEGIN
  SELECT data, revealed INTO v_data, v_rev FROM match_secrets WHERE match_id = p_match;
  IF v_data IS NULL OR NOT v_rev THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('word', v_data->>'word', 'imposter', v_data->>'imposter');
END; $$;

-- ── Persisted state (host OR any listed participant may write) ──
-- Enables mid-game refresh recovery and host migration.
CREATE OR REPLACE FUNCTION match_set_state(p_match uuid, p_state jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_host uuid; v_players jsonb;
BEGIN
  SELECT host_id INTO v_host FROM game_matches WHERE id = p_match;
  IF v_host = auth.uid() THEN
    UPDATE game_matches SET state = p_state WHERE id = p_match; RETURN;
  END IF;
  SELECT data->'players' INTO v_players FROM match_secrets WHERE match_id = p_match;
  IF is_member(v_players) THEN
    UPDATE game_matches SET state = p_state WHERE id = p_match; RETURN;
  END IF;
  RAISE EXCEPTION 'not allowed';
END; $$;

-- ── SKETCH RUSH ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sketch_set_word(p_match uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_host uuid;
  v_words text[] := ARRAY['cat','house','rocket','guitar','pizza','tree','robot','flower','boat','star','fish','clock','ladder','umbrella','balloon','ghost','anchor','cactus','dragon','igloo','kite','lighthouse','mountain','octopus','penguin','rainbow','snowman','telescope','volcano','windmill'];
  v_word text;
BEGIN
  SELECT host_id INTO v_host FROM game_matches WHERE id = p_match;
  IF v_host <> auth.uid() THEN RAISE EXCEPTION 'only host'; END IF;
  v_word := v_words[1 + floor(random() * array_length(v_words, 1))::int];
  INSERT INTO match_secrets (match_id, data, revealed, updated_at)
  VALUES (p_match, jsonb_build_object('word', v_word), false, now())
  ON CONFLICT (match_id) DO UPDATE SET data = EXCLUDED.data, revealed = false, updated_at = now();
END; $$;

-- Guesser submits; returns whether correct. On a correct guess the word is revealed.
CREATE OR REPLACE FUNCTION sketch_guess(p_match uuid, p_guess text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_word text; v_correct boolean;
BEGIN
  SELECT data->>'word' INTO v_word FROM match_secrets WHERE match_id = p_match;
  IF v_word IS NULL THEN RETURN false; END IF;
  v_correct := lower(trim(p_guess)) = lower(v_word);
  IF v_correct THEN UPDATE match_secrets SET revealed = true, updated_at = now() WHERE match_id = p_match; END IF;
  RETURN v_correct;
END; $$;

-- Word visible to the drawer (host) always; to everyone once revealed.
CREATE OR REPLACE FUNCTION sketch_word(p_match uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_word text; v_rev boolean; v_host uuid;
BEGIN
  SELECT data->>'word', revealed INTO v_word, v_rev FROM match_secrets WHERE match_id = p_match;
  SELECT host_id INTO v_host FROM game_matches WHERE id = p_match;
  IF v_word IS NULL THEN RETURN NULL; END IF;
  IF v_host = auth.uid() OR v_rev THEN RETURN v_word; END IF;
  RETURN NULL;
END; $$;

GRANT EXECUTE ON FUNCTION
  imposter_deal(uuid, uuid[]), imposter_my_role(uuid), imposter_reveal_now(uuid),
  imposter_truth(uuid), match_set_state(uuid, jsonb),
  sketch_set_word(uuid), sketch_guess(uuid, text), sketch_word(uuid)
  TO authenticated;

-- ────────────────────────────────────────────────────────────
-- CANVAS — append-only strokes (no more last-writer-wins overwrite)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS canvas_strokes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   uuid NOT NULL REFERENCES canvas_boards(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  stroke     jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS canvas_strokes_board_idx ON canvas_strokes (board_id, created_at);

ALTER TABLE canvas_strokes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read canvas strokes" ON canvas_strokes;
CREATE POLICY "Anyone can read canvas strokes"
  ON canvas_strokes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can add canvas strokes" ON canvas_strokes;
CREATE POLICY "Authenticated can add canvas strokes"
  ON canvas_strokes FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authenticated can clear canvas strokes" ON canvas_strokes;
CREATE POLICY "Authenticated can clear canvas strokes"
  ON canvas_strokes FOR DELETE USING (auth.role() = 'authenticated');

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE canvas_strokes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
