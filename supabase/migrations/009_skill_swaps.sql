-- ============================================================
-- Lounge: Learning Lounge — Skill Swap Board
-- Posts (offering / seeking) gain an optional return-skill and an optional
-- directed "ping". A swap is a handshake: another member proposes, filling
-- in their side of the exchange; the post author accepts or declines.
-- Run after 008. Safe to re-run.
-- ============================================================

-- ── Extend posts ────────────────────────────────────────────
ALTER TABLE skill_swaps
  ADD COLUMN IF NOT EXISTS counter_skill text,                                   -- the optional skill wanted/offered in return
  ADD COLUMN IF NOT EXISTS ping_user_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','matched','closed'));

-- Authors can take their own posts down.
DROP POLICY IF EXISTS "Authors delete their swaps" ON skill_swaps;
CREATE POLICY "Authors delete their swaps"
  ON skill_swaps FOR DELETE USING (auth.uid() = author_id);

-- ── Proposals (the actual swap handshake) ───────────────────
CREATE TABLE IF NOT EXISTS skill_swap_proposals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id        uuid NOT NULL REFERENCES skill_swaps(id) ON DELETE CASCADE,
  post_author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- who must respond
  proposer_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- who initiates
  their_skill    text,                 -- what the proposer brings (fills the gap when the post left it open)
  their_blurb    text,
  their_tags     text[] DEFAULT '{}'::text[],
  message        text,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at     timestamptz DEFAULT now(),
  UNIQUE (post_id, proposer_id)
);

CREATE INDEX IF NOT EXISTS swap_proposals_author_idx   ON skill_swap_proposals(post_author_id);
CREATE INDEX IF NOT EXISTS swap_proposals_proposer_idx ON skill_swap_proposals(proposer_id);
CREATE INDEX IF NOT EXISTS swap_proposals_post_idx     ON skill_swap_proposals(post_id);

ALTER TABLE skill_swap_proposals ENABLE ROW LEVEL SECURITY;

-- Only the two parties can see a proposal.
DROP POLICY IF EXISTS "Parties read proposals" ON skill_swap_proposals;
CREATE POLICY "Parties read proposals" ON skill_swap_proposals FOR SELECT
  USING (auth.uid() = proposer_id OR auth.uid() = post_author_id);

-- You propose as yourself, and not to your own post.
DROP POLICY IF EXISTS "Members propose swaps" ON skill_swap_proposals;
CREATE POLICY "Members propose swaps" ON skill_swap_proposals FOR INSERT
  WITH CHECK (auth.uid() = proposer_id AND proposer_id <> post_author_id);

-- The post author accepts / declines.
DROP POLICY IF EXISTS "Author responds to proposals" ON skill_swap_proposals;
CREATE POLICY "Author responds to proposals" ON skill_swap_proposals FOR UPDATE
  USING (auth.uid() = post_author_id) WITH CHECK (auth.uid() = post_author_id);

-- The proposer can withdraw.
DROP POLICY IF EXISTS "Proposer withdraws" ON skill_swap_proposals;
CREATE POLICY "Proposer withdraws" ON skill_swap_proposals FOR DELETE
  USING (auth.uid() = proposer_id);
