-- ============================================================
-- Lounge: Demo Seed Data
-- Realistic content for an internal team platform.
-- Run after the core schema migration.
-- ============================================================

-- Courses are authored by team members in-app; no demo courses are seeded.

-- Games
INSERT INTO games (id, title, mode, avg_minutes)
SELECT 'a0000000-0000-0000-0000-000000000001', 'Memory Match', 'solo', 5
WHERE NOT EXISTS (SELECT 1 FROM games WHERE title = 'Memory Match');

INSERT INTO games (id, title, mode, avg_minutes)
SELECT 'a0000000-0000-0000-0000-000000000002', 'Number Puzzle', 'solo', 10
WHERE NOT EXISTS (SELECT 1 FROM games WHERE title = 'Number Puzzle');

INSERT INTO games (id, title, mode, avg_minutes)
SELECT 'a0000000-0000-0000-0000-000000000003', 'Code Golf', 'head_to_head', 15
WHERE NOT EXISTS (SELECT 1 FROM games WHERE title = 'Code Golf');

-- Brain Teasers (today + recent)
INSERT INTO brain_teasers (date, prompt, answer)
SELECT CURRENT_DATE, 'I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?', 'echo'
WHERE NOT EXISTS (SELECT 1 FROM brain_teasers WHERE date = CURRENT_DATE);

INSERT INTO brain_teasers (date, prompt, answer)
SELECT CURRENT_DATE - 1, 'The more you take, the more you leave behind. What am I?', 'footsteps'
WHERE NOT EXISTS (SELECT 1 FROM brain_teasers WHERE date = CURRENT_DATE - 1);

INSERT INTO brain_teasers (date, prompt, answer)
SELECT CURRENT_DATE - 2, 'I have cities but no houses, forests but no trees, and water but no fish. What am I?', 'map'
WHERE NOT EXISTS (SELECT 1 FROM brain_teasers WHERE date = CURRENT_DATE - 2);

INSERT INTO brain_teasers (date, prompt, answer)
SELECT CURRENT_DATE - 3, 'What can travel around the world while staying in a corner?', 'stamp'
WHERE NOT EXISTS (SELECT 1 FROM brain_teasers WHERE date = CURRENT_DATE - 3);

-- Canvas Board
INSERT INTO canvas_boards (title, snapshot)
SELECT 'Team Whiteboard', '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM canvas_boards WHERE title = 'Team Whiteboard');
