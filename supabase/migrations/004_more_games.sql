-- ============================================================
-- Lounge: extra games (2048 solo + Imposter multiplayer).
-- Run after 003. Safe to re-run.
-- ============================================================

INSERT INTO games (id, title, mode, avg_minutes) VALUES
  ('a0000000-0000-0000-0000-000000000009', '2048',     'solo',         5),
  ('a0000000-0000-0000-0000-00000000000a', 'Imposter', 'head_to_head', 8)
ON CONFLICT (id) DO UPDATE
  SET title = EXCLUDED.title, mode = EXCLUDED.mode, avg_minutes = EXCLUDED.avg_minutes;
