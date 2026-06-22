import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useTeam, initials } from "@/hooks/useTeam";
import TeamMultiSelect from "@/components/TeamMultiSelect";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check, ImageIcon, Loader2, Plus, X } from "lucide-react";
import type { Wall } from "./MemeWall";

interface WallMember {
  wall_id: string;
  user_id: string;
  status: string | null;
}

interface Invite {
  wall_id: string;
  status: string | null;
  invited_by: string | null;
  wall: { id: string; title: string; created_at: string | null } | null;
}

export default function WallList({ onOpen }: { onOpen: (wall: Wall) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: team } = useTeam();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [inviteIds, setInviteIds] = useState<string[]>([]);

  const profileById = useMemo(() => {
    const map = new Map<string, { name: string | null; avatar_url: string | null }>();
    (team ?? []).forEach((m) => map.set(m.id, { name: m.name, avatar_url: m.avatar_url }));
    return map;
  }, [team]);

  // Walls the user owns or is an accepted member of.
  const { data: walls } = useQuery({
    queryKey: ["meme-walls", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Wall[]> => {
      const [owned, memberships] = await Promise.all([
        supabase
          .from("meme_walls")
          .select("id, title, created_at, created_by")
          .eq("created_by", user!.id),
        supabase
          .from("meme_wall_members")
          .select("wall_id")
          .eq("user_id", user!.id)
          .eq("status", "accepted"),
      ]);
      if (owned.error) throw owned.error;

      const memberWallIds = (memberships.data ?? []).map((m) => m.wall_id);
      let memberWalls: Wall[] = [];
      if (memberWallIds.length > 0) {
        const { data, error } = await supabase
          .from("meme_walls")
          .select("id, title, created_at, created_by")
          .in("id", memberWallIds);
        if (error) throw error;
        memberWalls = (data ?? []) as Wall[];
      }

      const byId = new Map<string, Wall>();
      [...((owned.data ?? []) as Wall[]), ...memberWalls].forEach((w) => byId.set(w.id, w));
      return [...byId.values()].sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      );
    },
    staleTime: 15_000,
  });

  const wallIds = (walls ?? []).map((w) => w.id);

  // Members of all visible walls (for avatar stacks).
  const { data: members } = useQuery({
    queryKey: ["meme-wall-members", wallIds],
    enabled: wallIds.length > 0,
    queryFn: async (): Promise<WallMember[]> => {
      const { data, error } = await supabase
        .from("meme_wall_members")
        .select("wall_id, user_id, status")
        .in("wall_id", wallIds)
        .eq("status", "accepted");
      if (error) throw error;
      return (data ?? []) as WallMember[];
    },
    staleTime: 15_000,
  });

  const membersByWall = (members ?? []).reduce<Record<string, string[]>>((acc, m) => {
    (acc[m.wall_id] ??= []).push(m.user_id);
    return acc;
  }, {});

  // Pending invites for the current user.
  const { data: invites } = useQuery({
    queryKey: ["meme-wall-invites", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase
        .from("meme_wall_members")
        .select("wall_id, status, invited_by, wall:meme_walls(id, title, created_at)")
        .eq("user_id", user!.id)
        .eq("status", "invited");
      if (error) throw error;
      return (data ?? []) as unknown as Invite[];
    },
    staleTime: 15_000,
  });

  const respondInvite = useMutation({
    mutationFn: async ({ wallId, status }: { wallId: string; status: "accepted" | "declined" }) => {
      const { error } = await supabase
        .from("meme_wall_members")
        .update({ status })
        .eq("wall_id", wallId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meme-wall-invites", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["meme-walls", user?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not respond"),
  });

  const createWall = useMutation({
    mutationFn: async (): Promise<Wall> => {
      if (!user) throw new Error("Not signed in");
      const trimmed = title.trim();
      if (!trimmed) throw new Error("Give your wall a title");

      const { data: wall, error } = await supabase
        .from("meme_walls")
        .insert({ title: trimmed, created_by: user.id })
        .select("id, title, created_at, created_by")
        .single();
      if (error || !wall) throw error ?? new Error("Could not create wall");

      const rows = [
        { wall_id: wall.id, user_id: user.id, status: "accepted", invited_by: user.id },
        ...inviteIds.map((id) => ({
          wall_id: wall.id,
          user_id: id,
          status: "invited",
          invited_by: user.id,
        })),
      ];
      const { error: memberError } = await supabase.from("meme_wall_members").insert(rows);
      if (memberError) throw memberError;

      return wall as Wall;
    },
    onSuccess: (wall) => {
      toast.success("Wall created!");
      setOpen(false);
      setTitle("");
      setInviteIds([]);
      queryClient.invalidateQueries({ queryKey: ["meme-walls", user?.id] });
      onOpen(wall);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create wall"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Meme Wall</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Spin up a wall, invite the crew, and post the good stuff.
          </p>
        </div>

        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setTitle("");
              setInviteIds([]);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="shrink-0 rounded-2xl">
              <Plus className="w-4 h-4" /> New wall
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border/30">
            <DialogHeader>
              <DialogTitle className="font-display">New meme wall</DialogTitle>
              <DialogDescription>Name it and invite teammates to post.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Wall title (e.g. Monday Energy)"
              />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Invite the crew</p>
                <TeamMultiSelect value={inviteIds} onChange={setInviteIds} />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createWall.mutate()}
                disabled={createWall.isPending || !title.trim()}
                className="rounded-xl"
              >
                {createWall.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating…
                  </>
                ) : (
                  "Create wall"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Invites */}
      {invites && invites.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-sm font-semibold text-foreground">Invites</h3>
          {invites.map((inv) => {
            const inviter = inv.invited_by ? profileById.get(inv.invited_by) : null;
            return (
              <Card
                key={inv.wall_id}
                className="p-3 bg-card/60 border-border/30 rounded-2xl flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium truncate">
                    {inv.wall?.title ?? "A meme wall"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Invited by {inviter?.name ?? "a teammate"}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="rounded-xl"
                  disabled={respondInvite.isPending}
                  onClick={() => respondInvite.mutate({ wallId: inv.wall_id, status: "accepted" })}
                >
                  <Check className="w-3.5 h-3.5" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  disabled={respondInvite.isPending}
                  onClick={() => respondInvite.mutate({ wallId: inv.wall_id, status: "declined" })}
                >
                  <X className="w-3.5 h-3.5" /> Decline
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Walls */}
      {walls && walls.length === 0 ? (
        <Card className="p-10 bg-card/40 border-border/30 rounded-2xl text-center">
          <ImageIcon className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No walls yet — create one and invite the crew.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(walls ?? []).map((wall) => {
            const memberIds = membersByWall[wall.id] ?? [];
            return (
              <Card
                key={wall.id}
                onClick={() => onOpen(wall)}
                className="p-5 bg-card/60 border-border/30 rounded-2xl cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-colors flex flex-col gap-4"
              >
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground truncate">
                    {wall.title}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {wall.created_at
                      ? new Date(wall.created_at).toLocaleDateString("en-GB")
                      : ""}
                  </p>
                </div>
                <div className="flex items-center -space-x-2 mt-auto">
                  {memberIds.slice(0, 5).map((id) => {
                    const p = profileById.get(id);
                    return (
                      <Avatar key={id} className="w-7 h-7 ring-2 ring-card">
                        <AvatarImage src={p?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                          {initials(p?.name)}
                        </AvatarFallback>
                      </Avatar>
                    );
                  })}
                  {memberIds.length > 5 && (
                    <span className="w-7 h-7 rounded-full bg-muted/30 ring-2 ring-card flex items-center justify-center text-[10px] text-muted-foreground">
                      +{memberIds.length - 5}
                    </span>
                  )}
                  {memberIds.length === 0 && (
                    <span className="text-[11px] text-muted-foreground">No members yet</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
