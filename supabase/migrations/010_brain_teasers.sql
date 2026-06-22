-- ============================================================
-- Lounge: Learning Lounge — Brain Teaser Leaderboard
-- A fresh teaser is auto-generated each day from a bank. Answers never reach
-- the client (checked server-side), entries are written only via RPC, and
-- each entry carries its teaser_date so streaks/weekly winners need no join.
-- Run after 009. Safe to re-run.
-- ============================================================

-- ── Teaser bank (source for daily auto-generation) ──────────
CREATE TABLE IF NOT EXISTS teaser_bank (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt text NOT NULL UNIQUE,
  answer text NOT NULL
);
-- RLS on, no policies: only the SECURITY DEFINER functions below may read it.
ALTER TABLE teaser_bank ENABLE ROW LEVEL SECURITY;

INSERT INTO teaser_bank (prompt, answer) VALUES
  ('I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?', 'echo'),
  ('The more you take, the more you leave behind. What am I?', 'footsteps'),
  ('I have cities but no houses, forests but no trees, and water but no fish. What am I?', 'map'),
  ('What can travel around the world while staying in a corner?', 'stamp'),
  ('What has keys but no locks, space but no room, and you can enter but not go inside?', 'keyboard'),
  ('What has hands but cannot clap?', 'clock'),
  ('What has a head, a tail, but no body?', 'coin'),
  ('What gets wetter the more it dries?', 'towel'),
  ('What has many teeth but cannot bite?', 'comb'),
  ('What has one eye but cannot see?', 'needle'),
  ('What has a neck but no head?', 'bottle'),
  ('What can you catch but not throw?', 'cold'),
  ('What goes up but never comes down?', 'age'),
  ('The more of this there is, the less you see. What is it?', 'darkness'),
  ('What has words but never speaks?', 'book'),
  ('What runs but never walks, has a bed but never sleeps?', 'river'),
  ('What has a thumb and four fingers but is not alive?', 'glove'),
  ('What building has the most stories?', 'library'),
  ('What can fill a room but takes up no space?', 'light'),
  ('What has legs but does not walk?', 'table'),
  ('What has a face and two hands but no arms or legs?', 'clock'),
  ('What kind of band never plays music?', 'rubberband'),
  ('What has to be broken before you can use it?', 'egg'),
  ('I am tall when I am young and short when I am old. What am I?', 'candle'),
  ('What month of the year has 28 days?', 'all'),
  ('What is full of holes but still holds water?', 'sponge'),
  ('What question can you never answer yes to?', 'asleep'),
  ('What is always in front of you but cannot be seen?', 'future'),
  ('There is a one-storey house where everything is yellow. What colour are the stairs?', 'none'),
  ('What can you keep after giving to someone?', 'word'),
  ('What invention lets you look right through a wall?', 'window'),
  ('What flies without wings?', 'time'),
  ('What can run but never walks, murmurs but never talks?', 'river'),
  ('I have branches but no fruit, trunk, or leaves. What am I?', 'bank'),
  ('What gets bigger the more you take away from it?', 'hole'),
  ('What has many keys but cannot open a single lock?', 'piano'),
  ('What comes down but never goes up?', 'rain'),
  ('I am light as a feather, yet the strongest person cannot hold me for much longer than a minute. What am I?', 'breath'),
  ('What has an end but no beginning, a home but no family, and a space without room?', 'keyboard'),
  ('Forwards I am heavy, but backwards I am not. What am I?', 'ton')
ON CONFLICT (prompt) DO NOTHING;

-- ── Hide live teaser answers from the client ────────────────
-- The table keeps RLS enabled; removing the public read policy means no client
-- can SELECT it directly (and therefore cannot read `answer`). Access is only
-- via the functions below.
DROP POLICY IF EXISTS "Anyone can read brain teasers" ON brain_teasers;

-- ── Entries: carry the date; write only via RPC ─────────────
ALTER TABLE leaderboard_entries
  ADD COLUMN IF NOT EXISTS teaser_date date;

UPDATE leaderboard_entries le
  SET teaser_date = b.date
  FROM brain_teasers b
  WHERE b.id = le.teaser_id AND le.teaser_date IS NULL;

-- No direct client inserts — only submit_teaser_answer() may add rows.
DROP POLICY IF EXISTS "Users can insert entries" ON leaderboard_entries;
-- (SELECT policy "Anyone can read leaderboard" from 001 stays.)

-- One solve per person per teaser.
CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_entries_teaser_user_uidx
  ON leaderboard_entries(teaser_id, user_id);
CREATE INDEX IF NOT EXISTS leaderboard_entries_date_idx ON leaderboard_entries(teaser_date);

-- ── Auto-generate today's teaser from the bank ──────────────
CREATE OR REPLACE FUNCTION ensure_daily_teaser()
RETURNS brain_teasers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row brain_teasers; v_prompt text; v_answer text;
BEGIN
  SELECT * INTO v_row FROM brain_teasers WHERE date = CURRENT_DATE;
  IF FOUND THEN RETURN v_row; END IF;

  -- Prefer a teaser never used before; fall back to any once the bank cycles.
  SELECT tb.prompt, tb.answer INTO v_prompt, v_answer
  FROM teaser_bank tb
  WHERE NOT EXISTS (SELECT 1 FROM brain_teasers b WHERE b.prompt = tb.prompt)
  ORDER BY random() LIMIT 1;

  IF v_prompt IS NULL THEN
    SELECT tb.prompt, tb.answer INTO v_prompt, v_answer FROM teaser_bank tb ORDER BY random() LIMIT 1;
  END IF;

  IF v_prompt IS NULL THEN RETURN NULL; END IF;  -- empty bank

  INSERT INTO brain_teasers (date, prompt, answer)
  VALUES (CURRENT_DATE, v_prompt, v_answer)
  ON CONFLICT (date) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM brain_teasers WHERE date = CURRENT_DATE;  -- lost the race
  END IF;
  RETURN v_row;
END; $$;

-- ── Today's teaser for the client (NO answer) ───────────────
CREATE OR REPLACE FUNCTION get_today_teaser()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row brain_teasers; v_uid uuid := auth.uid(); v_secs int;
BEGIN
  v_row := ensure_daily_teaser();
  IF v_row.id IS NULL THEN RETURN NULL; END IF;
  SELECT solve_seconds INTO v_secs FROM leaderboard_entries
    WHERE teaser_id = v_row.id AND user_id = v_uid;
  RETURN jsonb_build_object(
    'id', v_row.id,
    'date', v_row.date,
    'prompt', v_row.prompt,
    'solved', v_secs IS NOT NULL,
    'solve_seconds', v_secs
  );
END; $$;

-- ── Check an answer server-side, record on success ──────────
CREATE OR REPLACE FUNCTION submit_teaser_answer(p_teaser uuid, p_answer text, p_solve_seconds int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_answer text;
  v_date date;
  v_norm_in text;
  v_norm_ans text;
  v_exists boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'must be signed in'; END IF;

  SELECT answer, date INTO v_answer, v_date FROM brain_teasers WHERE id = p_teaser;
  IF v_answer IS NULL THEN RETURN jsonb_build_object('correct', false, 'error', 'no teaser'); END IF;

  v_norm_in  := lower(regexp_replace(coalesce(p_answer, ''), '[^a-zA-Z0-9]', '', 'g'));
  v_norm_ans := lower(regexp_replace(v_answer, '[^a-zA-Z0-9]', '', 'g'));

  IF v_norm_in = '' OR v_norm_in <> v_norm_ans THEN
    RETURN jsonb_build_object('correct', false);
  END IF;

  SELECT EXISTS (SELECT 1 FROM leaderboard_entries WHERE teaser_id = p_teaser AND user_id = v_uid)
    INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO leaderboard_entries (teaser_id, user_id, solve_seconds, teaser_date)
    VALUES (p_teaser, v_uid, GREATEST(coalesce(p_solve_seconds, 0), 0), v_date)
    ON CONFLICT (teaser_id, user_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('correct', true, 'already', v_exists);
END; $$;

GRANT EXECUTE ON FUNCTION get_today_teaser() TO authenticated;
GRANT EXECUTE ON FUNCTION submit_teaser_answer(uuid, text, int) TO authenticated;
