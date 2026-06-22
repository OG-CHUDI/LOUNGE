// Shared types + constants for the Skill Swap board.

export type SwapType = "offering" | "seeking";
export type SwapStatus = "open" | "matched" | "closed";
export type ProposalStatus = "pending" | "accepted" | "declined";

export interface SwapAuthor {
  id: string;
  name: string | null;
  role: string | null;
  avatar_url: string | null;
}

export interface SwapRow {
  id: string;
  type: SwapType;
  skill: string;
  blurb: string | null;
  tags: string[] | null;
  counter_skill: string | null;
  ping_user_id: string | null;
  status: SwapStatus;
  author_id: string;
  created_at: string;
  author?: SwapAuthor | null;
  ping?: SwapAuthor | null;
}

export interface ProposalRow {
  id: string;
  post_id: string;
  post_author_id: string;
  proposer_id: string;
  their_skill: string | null;
  their_blurb: string | null;
  their_tags: string[] | null;
  message: string | null;
  status: ProposalStatus;
  created_at: string;
  post?: SwapRow | null;
  proposer?: SwapAuthor | null;
  post_author?: SwapAuthor | null;
}

// Fields a skill can fall under (used as filterable tags).
export const SKILL_FIELDS = [
  "UX",
  "UI",
  "Frontend",
  "Backend",
  "AI/ML",
  "Data",
  "Design",
  "Product",
  "Strategy",
  "Research",
  "Comms",
  "Ops",
] as const;

export function initials(name: string | null | undefined): string {
  return (name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * What the other party brings to a swap, from the post's perspective.
 * For an "offering" post the responder is the learner (so the post owner
 * wants `counter_skill` back); for "seeking" it's the reverse. Returns the
 * label to prompt the responder with, and whether the post already names it.
 */
export function counterPrompt(post: SwapRow): { label: string; prefilled: string | null } {
  if (post.type === "offering") {
    return {
      label: `What will you offer ${post.author?.name ?? "them"} in return?`,
      prefilled: post.counter_skill,
    };
  }
  return {
    label: `What can you teach them? (they want to learn ${post.skill})`,
    prefilled: post.counter_skill,
  };
}
