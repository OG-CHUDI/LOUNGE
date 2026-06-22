-- ============================================================
-- Lounge: Learning Lounge — AMA sessions.
-- An assisted group chat between a host, the spotlight people it's created
-- with, and anyone explicitly invited. Invite-gated: only those people can
-- see or post. Instant or scheduled, with an extendable timer, a fun/pro
-- question bank, and a browsable archive of ended sessions.
-- Replaces the thin amas / ama_questions tables from 001.
-- Run after 011. Safe to re-run.
-- ============================================================

-- Drop the course → AMA link before swapping the table it points at.
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_clarify_ama_id_fkey;
DROP TABLE IF EXISTS ama_questions;
DROP TABLE IF EXISTS amas;

-- ── Sessions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ama_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  mode             text NOT NULL DEFAULT 'both' CHECK (mode IN ('fun','professional','both')),
  spotlight_ids    uuid[] NOT NULL DEFAULT '{}'::uuid[],  -- the people being asked
  invited_ids      uuid[] NOT NULL DEFAULT '{}'::uuid[],  -- extra people allowed in
  status           text NOT NULL DEFAULT 'live' CHECK (status IN ('scheduled','live','ended')),
  scheduled_at     timestamptz,
  started_at       timestamptz,
  expires_at       timestamptz,
  duration_minutes int NOT NULL DEFAULT 30,
  extensions       int NOT NULL DEFAULT 0,
  summary          text,
  course_id        uuid REFERENCES courses(id) ON DELETE SET NULL,
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ama_sessions_status_idx ON ama_sessions(status, created_at DESC);
ALTER TABLE ama_sessions ENABLE ROW LEVEL SECURITY;

-- Re-point the course "Ask in the AMA" link at the new sessions table.
ALTER TABLE courses
  ADD CONSTRAINT courses_clarify_ama_id_fkey
  FOREIGN KEY (clarify_ama_id) REFERENCES ama_sessions(id) ON DELETE SET NULL;

-- Membership = host, a spotlight, or an invitee. Used by every AMA policy.
CREATE OR REPLACE FUNCTION ama_is_member(p_session uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM ama_sessions s
    WHERE s.id = p_session
      AND (auth.uid() = s.host_id
           OR auth.uid() = ANY(s.spotlight_ids)
           OR auth.uid() = ANY(s.invited_ids))
  );
$$;

DROP POLICY IF EXISTS "Members read sessions" ON ama_sessions;
CREATE POLICY "Members read sessions" ON ama_sessions FOR SELECT
  USING (auth.uid() = host_id OR auth.uid() = ANY(spotlight_ids) OR auth.uid() = ANY(invited_ids));

DROP POLICY IF EXISTS "Host creates sessions" ON ama_sessions;
CREATE POLICY "Host creates sessions" ON ama_sessions FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Host or a spotlight can drive the session (start, extend, end, summarise, invite more).
DROP POLICY IF EXISTS "Host or spotlight updates session" ON ama_sessions;
CREATE POLICY "Host or spotlight updates session" ON ama_sessions FOR UPDATE
  USING (auth.uid() = host_id OR auth.uid() = ANY(spotlight_ids))
  WITH CHECK (auth.uid() = host_id OR auth.uid() = ANY(spotlight_ids));

DROP POLICY IF EXISTS "Host deletes session" ON ama_sessions;
CREATE POLICY "Host deletes session" ON ama_sessions FOR DELETE USING (auth.uid() = host_id);

-- ── Messages (the live chat) ────────────────────────────────
CREATE TABLE IF NOT EXISTS ama_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES ama_sessions(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  kind       text NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat','question','answer','system')),
  body       text NOT NULL,
  reply_to   uuid REFERENCES ama_messages(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ama_messages_session_idx ON ama_messages(session_id, created_at);
ALTER TABLE ama_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read messages" ON ama_messages;
CREATE POLICY "Members read messages" ON ama_messages FOR SELECT USING (ama_is_member(session_id));

-- Post only as yourself, only while the session is live, and only if a member.
DROP POLICY IF EXISTS "Members post messages" ON ama_messages;
CREATE POLICY "Members post messages" ON ama_messages FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND ama_is_member(session_id)
    AND EXISTS (SELECT 1 FROM ama_sessions s WHERE s.id = session_id AND s.status = 'live')
  );

-- ── Participants (presence / "who attended") ────────────────
CREATE TABLE IF NOT EXISTS ama_participants (
  session_id uuid NOT NULL REFERENCES ama_sessions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at  timestamptz DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);
ALTER TABLE ama_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read participants" ON ama_participants;
CREATE POLICY "Members read participants" ON ama_participants FOR SELECT USING (ama_is_member(session_id));

DROP POLICY IF EXISTS "Join as self" ON ama_participants;
CREATE POLICY "Join as self" ON ama_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id AND ama_is_member(session_id));

-- ── Question bank (the "assist") ────────────────────────────
CREATE TABLE IF NOT EXISTS ama_question_bank (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode   text NOT NULL CHECK (mode IN ('fun','professional')),
  prompt text NOT NULL UNIQUE
);
ALTER TABLE ama_question_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads question bank" ON ama_question_bank;
CREATE POLICY "Anyone reads question bank" ON ama_question_bank FOR SELECT USING (true);

INSERT INTO ama_question_bank (mode, prompt) VALUES
  ('fun', 'What''s a hobby you''ve picked up recently?'),
  ('fun', 'If you could instantly master one skill, what would it be?'),
  ('fun', 'What''s the best meal you''ve had this year?'),
  ('fun', 'Cats, dogs, or neither — and why?'),
  ('fun', 'What''s a film or series you''d happily rewatch?'),
  ('fun', 'What''s your go-to karaoke song?'),
  ('fun', 'What''s something you believed as a kid that makes you laugh now?'),
  ('fun', 'Tea or coffee, and how do you take it?'),
  ('fun', 'What''s the last thing that made you genuinely laugh?'),
  ('fun', 'If you had a free weekend with no plans, what would you do?'),
  ('fun', 'What''s a small thing that instantly improves your day?'),
  ('fun', 'Window seat or aisle seat?'),
  ('fun', 'What''s a place you''d move to tomorrow if you could?'),
  ('fun', 'What''s your most-used emoji?'),
  ('fun', 'What''s a song that always gets you going?'),
  ('professional', 'What does a great day at work look like for you?'),
  ('professional', 'What''s a project you''re proudest of, and why?'),
  ('professional', 'What''s a tool or workflow you can''t live without?'),
  ('professional', 'What''s the best piece of career advice you''ve received?'),
  ('professional', 'What part of your craft do people underestimate?'),
  ('professional', 'How do you approach a problem you''ve never seen before?'),
  ('professional', 'What''s something you changed your mind about in your field?'),
  ('professional', 'What skill are you actively trying to improve right now?'),
  ('professional', 'How do you know when a piece of work is "done"?'),
  ('professional', 'What''s a mistake that taught you the most?'),
  ('professional', 'Who or what has shaped how you work?'),
  ('professional', 'How do you stay current in your area?'),
  ('professional', 'What''s a hard trade-off you''ve had to make recently?'),
  ('professional', 'What would you tell someone just starting in your role?'),
  ('professional', 'What''s an unpopular opinion you hold about your field?')
ON CONFLICT (prompt) DO NOTHING;

-- ── Live updates ────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ama_messages;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ama_sessions;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

-- ── Notifications: you've been added to / invited to an AMA ──
CREATE OR REPLACE FUNCTION trg_notify_ama_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid; v_host text;
BEGIN
  SELECT name INTO v_host FROM profiles WHERE id = NEW.host_id;
  FOR v_uid IN SELECT DISTINCT u FROM unnest(NEW.spotlight_ids || NEW.invited_ids) AS u LOOP
    IF v_uid <> NEW.host_id THEN
      PERFORM notify_user(
        v_uid, 'ama_invite',
        (CASE WHEN NEW.status = 'scheduled' THEN 'AMA scheduled: ' ELSE 'AMA started: ' END) || NEW.title,
        COALESCE(v_host, 'Someone') || ' added you' ||
          (CASE WHEN v_uid = ANY(NEW.spotlight_ids) THEN ' as a spotlight' ELSE '' END),
        '/learn/ama?s=' || NEW.id, jsonb_build_object('session_id', NEW.id)
      );
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_ama_created ON ama_sessions;
CREATE TRIGGER notify_ama_created AFTER INSERT ON ama_sessions
  FOR EACH ROW EXECUTE FUNCTION trg_notify_ama_created();

-- Notify members when a scheduled session goes live, or when new people are invited.
CREATE OR REPLACE FUNCTION trg_notify_ama_updated() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid;
BEGIN
  -- Scheduled → live: tell the spotlights + invitees it's starting.
  IF NEW.status = 'live' AND OLD.status = 'scheduled' THEN
    FOR v_uid IN SELECT DISTINCT u FROM unnest(NEW.spotlight_ids || NEW.invited_ids) AS u LOOP
      IF v_uid <> NEW.host_id THEN
        PERFORM notify_user(v_uid, 'ama_live', 'AMA starting: ' || NEW.title,
          'It''s live now — jump in.', '/learn/ama?s=' || NEW.id, jsonb_build_object('session_id', NEW.id));
      END IF;
    END LOOP;
  END IF;

  -- Newly added invitees (array grew): notify just the new ones.
  IF NEW.invited_ids IS DISTINCT FROM OLD.invited_ids THEN
    FOR v_uid IN
      SELECT u FROM unnest(NEW.invited_ids) AS u
      WHERE u <> ALL(OLD.invited_ids) AND u <> NEW.host_id
    LOOP
      PERFORM notify_user(v_uid, 'ama_invite', 'Invited to AMA: ' || NEW.title,
        'You can now join this session.', '/learn/ama?s=' || NEW.id, jsonb_build_object('session_id', NEW.id));
    END LOOP;
  END IF;

  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_ama_updated ON ama_sessions;
CREATE TRIGGER notify_ama_updated AFTER UPDATE ON ama_sessions
  FOR EACH ROW EXECUTE FUNCTION trg_notify_ama_updated();
