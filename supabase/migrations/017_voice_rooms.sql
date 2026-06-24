-- ============================================================
-- Airwaves › Drop-in Rooms — a registry of live voice rooms so the
-- team can discover and join them. The actual audio runs on LiveKit;
-- this table just tracks which rooms are open. The row id IS the
-- LiveKit room name.
-- Run after 016. Safe to re-run (idempotent).
-- ============================================================

CREATE TABLE IF NOT EXISTS voice_rooms (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  host_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_rooms_status_idx ON voice_rooms (status, created_at DESC);

ALTER TABLE voice_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read voice rooms" ON voice_rooms;
CREATE POLICY "Anyone can read voice rooms" ON voice_rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can open voice rooms" ON voice_rooms;
CREATE POLICY "Users can open voice rooms" ON voice_rooms FOR INSERT WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can update voice rooms" ON voice_rooms;
CREATE POLICY "Hosts can update voice rooms" ON voice_rooms FOR UPDATE USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can delete voice rooms" ON voice_rooms;
CREATE POLICY "Hosts can delete voice rooms" ON voice_rooms FOR DELETE USING (auth.uid() = host_id);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE voice_rooms; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
