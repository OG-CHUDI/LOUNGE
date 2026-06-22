import { useState } from "react";
import { Swords, Check, X, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTeam, initials } from "@/hooks/useTeam";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCreateMatch, useIncomingInvites, type MatchRow } from "./useMatch";

interface Props {
  gameId: string;
  initialState: Record<string, unknown>;
  /** Called once a match is created (host) or accepted (opponent). */
  onEnter: (match: MatchRow) => void;
}

/**
 * Shared multiplayer lobby: pick a teammate to challenge + see incoming
 * invites. Used by every head-to-head game.
 */
export default function MatchLobby({ gameId, initialState, onEnter }: Props) {
  const { user } = useAuth();
  const { data: team } = useTeam(user?.id);
  const createMatch = useCreateMatch();
  const { invites, accept, decline } = useIncomingInvites();
  const [busy, setBusy] = useState<string | null>(null);

  // Only show invites for this game.
  const myInvites = invites.filter((m) => m.game_id === gameId);

  const challenge = async (opponentId: string) => {
    setBusy(opponentId);
    const match = await createMatch(gameId, opponentId, initialState);
    setBusy(null);
    if (match) onEnter(match);
  };

  const onAccept = async (m: MatchRow) => {
    await accept(m.id);
    onEnter({ ...m, status: "active" });
  };

  return (
    <div className="space-y-5">
      {myInvites.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <h4 className="text-sm font-display font-semibold text-foreground mb-3">Incoming challenges</h4>
          <div className="space-y-2">
            {myInvites.map((m) => {
              const challenger = team?.find((t) => t.id === m.host_id);
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-xl bg-card/60 px-3 py-2">
                  <Avatar className="w-8 h-8 ring-1 ring-border/30">
                    <AvatarImage src={challenger?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                      {initials(challenger?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-sm text-foreground truncate">
                    {challenger?.name ?? "A teammate"} wants to play
                  </span>
                  <Button size="sm" onClick={() => onAccept(m)}>
                    <Check className="w-4 h-4" /> Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => decline(m.id)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/30 bg-card/60 p-4">
        <h4 className="text-sm font-display font-semibold text-foreground mb-3">Challenge a teammate</h4>
        {team && team.length > 0 ? (
          <div className="space-y-2">
            {team.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-card">
                <Avatar className="w-8 h-8 ring-1 ring-border/30">
                  <AvatarImage src={t.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                    {initials(t.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{t.name ?? "Teammate"}</p>
                  {t.role && <p className="text-[11px] text-muted-foreground truncate">{t.role}</p>}
                </div>
                <Button size="sm" disabled={!!busy} onClick={() => challenge(t.id)}>
                  {busy === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                  Challenge
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">No teammates to challenge yet.</p>
        )}
      </div>
    </div>
  );
}
