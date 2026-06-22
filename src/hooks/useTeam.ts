import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface TeamMember {
  id: string;
  name: string | null;
  role: string | null;
  avatar_url: string | null;
}

/**
 * Every profile on the platform — used for invite pickers and presence.
 * Optionally pass the current user id to exclude yourself from the list.
 */
export function useTeam(excludeUserId?: string) {
  return useQuery({
    queryKey: ["team"],
    queryFn: async (): Promise<TeamMember[]> => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, role, avatar_url")
        .order("name", { ascending: true });
      return (data ?? []) as TeamMember[];
    },
    staleTime: 120_000,
    select: (members) =>
      excludeUserId ? members.filter((m) => m.id !== excludeUserId) : members,
  });
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
