import { useAuth } from "@/lib/auth";
import { useTeam, initials } from "@/hooks/useTeam";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check } from "lucide-react";

/** Reusable invite picker — toggle teammates on/off. Excludes the current user. */
export default function TeamMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { user } = useAuth();
  const { data: team } = useTeam(user?.id);

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="max-h-56 overflow-y-auto scrollbar-thin rounded-xl border border-border/30 divide-y divide-border/15">
      {(team ?? []).map((m) => {
        const selected = value.includes(m.id);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => toggle(m.id)}
            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/10 transition-colors"
          >
            <Avatar className="w-7 h-7 ring-1 ring-border/30">
              <AvatarImage src={m.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                {initials(m.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">{m.name ?? "Team member"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{m.role ?? "Team Member"}</p>
            </div>
            <span
              className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                selected ? "bg-primary border-primary" : "border-border/50"
              }`}
            >
              {selected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
            </span>
          </button>
        );
      })}
      {team && team.length === 0 && (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">No other team members yet.</p>
      )}
    </div>
  );
}
