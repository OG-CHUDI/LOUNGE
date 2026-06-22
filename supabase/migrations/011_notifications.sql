-- ============================================================
-- Lounge: in-app notifications.
-- One row per recipient per event. Rows are written only by SECURITY DEFINER
-- triggers (clients cannot insert notifications for other users), and each
-- recipient can read / mark-read / delete only their own.
-- Run after 010. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- recipient
  type       text NOT NULL,
  title      text NOT NULL,
  body       text,
  link       text,                                   -- in-app route to open
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  read       boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, read, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own notifications" ON notifications;
CREATE POLICY "Read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update own notifications" ON notifications;
CREATE POLICY "Update own notifications" ON notifications FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Delete own notifications" ON notifications;
CREATE POLICY "Delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);
-- No INSERT policy: only the trigger functions below (SECURITY DEFINER) write rows.

-- Live updates for the bell.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
END $$;

-- Small helper so triggers don't repeat the insert.
CREATE OR REPLACE FUNCTION notify_user(
  p_user uuid, p_type text, p_title text, p_body text, p_link text, p_data jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user IS NULL THEN RETURN; END IF;
  INSERT INTO notifications (user_id, type, title, body, link, data)
  VALUES (p_user, p_type, p_title, p_body, p_link, COALESCE(p_data, '{}'::jsonb));
END; $$;

-- ── Skill swap events ───────────────────────────────────────
-- Someone proposes a swap on your post.
CREATE OR REPLACE FUNCTION trg_notify_swap_proposal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_skill text;
BEGIN
  SELECT name INTO v_name FROM profiles WHERE id = NEW.proposer_id;
  SELECT skill INTO v_skill FROM skill_swaps WHERE id = NEW.post_id;
  PERFORM notify_user(
    NEW.post_author_id, 'swap_request',
    COALESCE(v_name, 'Someone') || ' wants to swap',
    'On your post: ' || COALESCE(v_skill, 'a skill'),
    '/learn/skill-swap', jsonb_build_object('post_id', NEW.post_id, 'proposal_id', NEW.id)
  );
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_swap_proposal ON skill_swap_proposals;
CREATE TRIGGER notify_swap_proposal AFTER INSERT ON skill_swap_proposals
  FOR EACH ROW EXECUTE FUNCTION trg_notify_swap_proposal();

-- Your swap request was accepted / declined.
CREATE OR REPLACE FUNCTION trg_notify_swap_response() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_skill text;
BEGIN
  IF NEW.status = OLD.status OR NEW.status NOT IN ('accepted', 'declined') THEN RETURN NEW; END IF;
  SELECT skill INTO v_skill FROM skill_swaps WHERE id = NEW.post_id;
  PERFORM notify_user(
    NEW.proposer_id, 'swap_' || NEW.status,
    CASE WHEN NEW.status = 'accepted' THEN 'Swap accepted' ELSE 'Swap declined' END,
    COALESCE(v_skill, 'a skill') || (CASE WHEN NEW.status = 'accepted' THEN ' — reach out to set a time' ELSE '' END),
    '/learn/skill-swap', jsonb_build_object('post_id', NEW.post_id)
  );
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_swap_response ON skill_swap_proposals;
CREATE TRIGGER notify_swap_response AFTER UPDATE ON skill_swap_proposals
  FOR EACH ROW EXECUTE FUNCTION trg_notify_swap_response();

-- You were pinged on a new skill post.
CREATE OR REPLACE FUNCTION trg_notify_swap_ping() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF NEW.ping_user_id IS NULL OR NEW.ping_user_id = NEW.author_id THEN RETURN NEW; END IF;
  SELECT name INTO v_name FROM profiles WHERE id = NEW.author_id;
  PERFORM notify_user(
    NEW.ping_user_id, 'swap_ping',
    COALESCE(v_name, 'Someone') || ' pinged you',
    (CASE WHEN NEW.type = 'offering' THEN 'Offering: ' ELSE 'Seeking: ' END) || NEW.skill,
    '/learn/skill-swap', jsonb_build_object('post_id', NEW.id)
  );
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS notify_swap_ping ON skill_swaps;
CREATE TRIGGER notify_swap_ping AFTER INSERT ON skill_swaps
  FOR EACH ROW EXECUTE FUNCTION trg_notify_swap_ping();
