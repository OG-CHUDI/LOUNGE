-- ============================================================
-- Lounge: enlarge the teaser + AMA banks and make daily teaser
-- selection least-recently-used so content never repeats while unused
-- items remain, and repeats are maximally spaced once it must cycle.
-- Run after 012. Safe to re-run.
-- ============================================================

-- ── More brain teasers ──────────────────────────────────────
INSERT INTO teaser_bank (prompt, answer) VALUES
  ('What kind of room has no doors or windows?', 'mushroom'),
  ('What gets sharper the more you use it?', 'brain'),
  ('What can you break without ever touching it?', 'promise'),
  ('I have roots nobody sees and I''m taller than any tree. What am I?', 'mountain'),
  ('What begins with T, ends with T, and is full of T?', 'teapot'),
  ('The maker sells it, the buyer never uses it, the user never sees it. What is it?', 'coffin'),
  ('What kind of coat is only ever put on when wet?', 'paint'),
  ('What has teeth but cannot chew?', 'saw'),
  ('What runs all the way around a field but never moves?', 'fence'),
  ('What has one head, one foot, and four legs?', 'bed'),
  ('What has a tongue but cannot talk?', 'shoe'),
  ('What comes once in a minute, twice in a moment, but never in a thousand years?', 'm'),
  ('What is so fragile that saying its name breaks it?', 'silence'),
  ('What can fly without wings and weep without eyes?', 'cloud'),
  ('What goes up and down but never actually moves?', 'stairs'),
  ('What kind of tree can you always carry in your hand?', 'palm'),
  ('What has a heart that never beats?', 'artichoke'),
  ('What has a ring but no finger?', 'bell'),
  ('What is black when it''s clean and white when it''s dirty?', 'blackboard'),
  ('What goes up the moment the rain comes down?', 'umbrella'),
  ('What flies when it''s born, lies when it''s alive, and runs when it''s dead?', 'snowflake'),
  ('What is at the very end of a rainbow?', 'w'),
  ('What is always coming but never actually arrives?', 'tomorrow'),
  ('What is easy to get into but hard to get out of?', 'trouble'),
  ('What belongs to you but is used far more by everyone else?', 'name'),
  ('What follows you all day but disappears at night?', 'shadow'),
  ('What gets sealed with a lick and travels with a stamp?', 'envelope'),
  ('What has a bark but no bite and rings but no bell?', 'tree'),
  ('What can be cracked, made, told, and played?', 'joke'),
  ('What has 13 of these in a standard suit and none of them beat?', 'cards'),
  ('What is full of holes yet still holds a lot of weight?', 'net'),
  ('What word is spelled wrong in every dictionary?', 'wrong'),
  ('What has many rings but no fingers?', 'phone'),
  ('What can you hold without ever using your hands?', 'breath'),
  ('What kind of cup can''t hold water?', 'cupcake')
ON CONFLICT (prompt) DO NOTHING;

-- ── More AMA prompts ────────────────────────────────────────
INSERT INTO ama_question_bank (mode, prompt) VALUES
  ('fun', 'What''s a skill you''d love to learn purely for fun?'),
  ('fun', 'What''s your ideal way to spend a Sunday?'),
  ('fun', 'What''s a book, podcast, or video you''d recommend to anyone?'),
  ('fun', 'What''s the best trip you''ve ever taken?'),
  ('fun', 'What''s a small win you had this week?'),
  ('fun', 'If you could have dinner with anyone, who would it be?'),
  ('fun', 'What''s your ultimate comfort food?'),
  ('fun', 'What''s a hidden talent of yours?'),
  ('fun', 'What''s something on your bucket list?'),
  ('fun', 'Morning person or night owl?'),
  ('fun', 'What''s a game you loved growing up?'),
  ('fun', 'What''s your favourite season, and why?'),
  ('fun', 'What''s something you''re looking forward to right now?'),
  ('fun', 'If money were no object, how would you spend your days?'),
  ('fun', 'What''s the best advice a friend ever gave you?'),
  ('professional', 'What first got you into your field?'),
  ('professional', 'What resource would you recommend to someone learning your craft?'),
  ('professional', 'What habit has made you better at your job?'),
  ('professional', 'How do you handle feedback?'),
  ('professional', 'What problem in your field do you wish someone would solve?'),
  ('professional', 'What does great collaboration look like to you?'),
  ('professional', 'How do you decide what to work on first?'),
  ('professional', 'What skill outside your role helps you most at work?'),
  ('professional', 'What''s the most useful thing you learned in the last year?'),
  ('professional', 'How do you recover from a setback at work?'),
  ('professional', 'What''s a piece of jargon you wish would disappear?'),
  ('professional', 'How do you get up to speed on something new quickly?'),
  ('professional', 'What part of your work energises you most?'),
  ('professional', 'What''s a tool you''ve started using recently?'),
  ('professional', 'How do you measure success in your role?')
ON CONFLICT (prompt) DO NOTHING;

-- ── Least-recently-used daily teaser selection ──────────────
-- Unused teasers (never appearing in brain_teasers) sort first; once every
-- teaser has been used, the one used longest ago is chosen next. This means
-- no repeat until the whole bank is exhausted, and repeats are then maximally
-- spaced — never yesterday's.
CREATE OR REPLACE FUNCTION ensure_daily_teaser()
RETURNS brain_teasers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row brain_teasers; v_prompt text; v_answer text;
BEGIN
  SELECT * INTO v_row FROM brain_teasers WHERE date = CURRENT_DATE;
  IF FOUND THEN RETURN v_row; END IF;

  SELECT tb.prompt, tb.answer INTO v_prompt, v_answer
  FROM teaser_bank tb
  LEFT JOIN LATERAL (
    SELECT max(b.date) AS last_used FROM brain_teasers b WHERE b.prompt = tb.prompt
  ) u ON true
  ORDER BY u.last_used ASC NULLS FIRST, random()
  LIMIT 1;

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
