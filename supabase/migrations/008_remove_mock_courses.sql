-- ============================================================
-- Lounge: remove the demo/mock courses seeded by 002_seed_data.sql.
-- Only deletes the known seed rows that were never authored by a real
-- member (author_id IS NULL). Real, team-authored courses are untouched.
-- Safe to re-run.
-- ============================================================

DELETE FROM courses
WHERE author_id IS NULL
  AND title IN (
    'Design Systems at Scale',
    'Engineering Leadership 101',
    'Product Strategy for Senior ICs',
    'Writing Effective Design Docs',
    'Radical Candor in Remote Teams',
    'Accessibility by Default'
  );
