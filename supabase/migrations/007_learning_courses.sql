-- ============================================================
-- Lounge: Learning Lounge — Mini-Courses
-- Any team member can author a multi-section course (written / audio /
-- video), attach an optional auto-checked quiz (never failable), and link
-- an AMA for further clarification. Run after 006. Safe to re-run.
-- ============================================================

-- ── Extend the existing thin `courses` table ────────────────
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS author_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description    text,
  ADD COLUMN IF NOT EXISTS tags           text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS published      boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS clarify_ama_id uuid REFERENCES amas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS courses_author_idx ON courses(author_id);

-- Authors (any authenticated member) can create and manage their courses.
DROP POLICY IF EXISTS "Members can create courses" ON courses;
CREATE POLICY "Members can create courses"
  ON courses FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors manage their courses" ON courses;
CREATE POLICY "Authors manage their courses"
  ON courses FOR UPDATE USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors delete their courses" ON courses;
CREATE POLICY "Authors delete their courses"
  ON courses FOR DELETE USING (auth.uid() = author_id);

-- ── Sections (ordered lessons; one material kind each) ──────
CREATE TABLE IF NOT EXISTS course_sections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position         int  NOT NULL DEFAULT 0,
  title            text NOT NULL DEFAULT 'Untitled section',
  kind             text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','audio','video')),
  body             text,            -- markdown/plain text; optional notes/transcript for media
  media_url        text,            -- uploaded asset (audio, or uploaded video) public URL
  embed_url        text,            -- external video embed (YouTube / Loom / Drive / Vimeo)
  duration_seconds int,             -- uploaded media length, for display + the 4-min cap
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_sections_course_idx ON course_sections(course_id, position);
ALTER TABLE course_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads sections" ON course_sections;
CREATE POLICY "Anyone reads sections" ON course_sections FOR SELECT USING (true);

DROP POLICY IF EXISTS "Course author writes sections" ON course_sections;
CREATE POLICY "Course author writes sections" ON course_sections FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND c.author_id = auth.uid()));

DROP POLICY IF EXISTS "Course author updates sections" ON course_sections;
CREATE POLICY "Course author updates sections" ON course_sections FOR UPDATE
  USING (EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND c.author_id = auth.uid()));

DROP POLICY IF EXISTS "Course author deletes sections" ON course_sections;
CREATE POLICY "Course author deletes sections" ON course_sections FOR DELETE
  USING (EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND c.author_id = auth.uid()));

-- ── Quiz questions (auto-checked, never failable) ───────────
CREATE TABLE IF NOT EXISTS course_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position    int  NOT NULL DEFAULT 0,
  kind        text NOT NULL DEFAULT 'single' CHECK (kind IN ('single','multi','boolean','short')),
  prompt      text NOT NULL,
  options     jsonb DEFAULT '[]'::jsonb,  -- [{ "id": "a", "text": "..." }] for single/multi
  correct     jsonb,                      -- single: "a"; multi: ["a","b"]; boolean: true; short: null
  explanation text,                       -- shown after answering, right or wrong
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_questions_course_idx ON course_questions(course_id, position);
ALTER TABLE course_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads questions" ON course_questions;
CREATE POLICY "Anyone reads questions" ON course_questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Course author writes questions" ON course_questions;
CREATE POLICY "Course author writes questions" ON course_questions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND c.author_id = auth.uid()));

DROP POLICY IF EXISTS "Course author updates questions" ON course_questions;
CREATE POLICY "Course author updates questions" ON course_questions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND c.author_id = auth.uid()));

DROP POLICY IF EXISTS "Course author deletes questions" ON course_questions;
CREATE POLICY "Course author deletes questions" ON course_questions FOR DELETE
  USING (EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND c.author_id = auth.uid()));

-- ── Learner progress (extend existing course_progress) ──────
ALTER TABLE course_progress
  ADD COLUMN IF NOT EXISTS completed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS quiz_responses jsonb,
  ADD COLUMN IF NOT EXISTS quiz_score     numeric;   -- soft self-check score, never a gate

-- ── Storage bucket for uploaded audio / video / covers ──────
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-media', 'course-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read course media" ON storage.objects;
CREATE POLICY "Public read course media" ON storage.objects FOR SELECT
  USING (bucket_id = 'course-media');

-- Uploads must live under the uploader's own user-id folder (matches the
-- `${user.id}/...` path the client writes).
DROP POLICY IF EXISTS "Members upload course media" ON storage.objects;
CREATE POLICY "Members upload course media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owners update course media" ON storage.objects;
CREATE POLICY "Owners update course media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'course-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owners delete course media" ON storage.objects;
CREATE POLICY "Owners delete course media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'course-media' AND (storage.foldername(name))[1] = auth.uid()::text);
