import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import TeamMultiSelect from "@/components/TeamMultiSelect";
import { useTeam, initials, type TeamMember } from "@/hooks/useTeam";
import { toast } from "sonner";
import { Plus, Palette, Check, X, Mail } from "lucide-react";
import type { Stroke } from "./useBoardRealtime";

interface BoardRow {
  id: string;
  title: string;
  snapshot: { strokes?: Stroke[] } | null;
  created_by: string;
  created_at: string;
}

interface MemberRow {
  board_id: string;
  user_id: string;
  status: "invited" | "accepted" | "declined";
  invited_by: string;
}

interface InviteRow extends MemberRow {
  board: { id: string; title: string } | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function BoardList({
  onOpenBoard,
}: {
  onOpenBoard: (board: { id: string; title: string; strokes: Stroke[] }) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: team } = useTeam(user?.id);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);

  const teamById = useMemo(() => {
    const map = new Map<string, TeamMember>();
    for (const m of team ?? []) map.set(m.id, m);
    return map;
  }, [team]);

  // Boards I can see: created by me, OR I'm an accepted member.
  const boardsQuery = useQuery({
    queryKey: ["canvas-boards", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Memberships (any status) tell us both my accepted boards and who's on each.
      const { data: myMemberships } = await supabase
        .from("canvas_members")
        .select("board_id, user_id, status, invited_by")
        .eq("user_id", user!.id)
        .eq("status", "accepted");

      const acceptedIds = (myMemberships ?? []).map((m) => m.board_id);

      // Fetch boards created by me OR in my accepted set.
      const orParts = [`created_by.eq.${user!.id}`];
      if (acceptedIds.length > 0) {
        orParts.push(`id.in.(${acceptedIds.join(",")})`);
      }
      const { data: boards, error } = await supabase
        .from("canvas_boards")
        .select("id, title, snapshot, created_by, created_at")
        .or(orParts.join(","))
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (boards ?? []) as BoardRow[];

      // Members for avatars (accepted members of these boards).
      const ids = rows.map((b) => b.id);
      let membersByBoard = new Map<string, string[]>();
      if (ids.length > 0) {
        const { data: members } = await supabase
          .from("canvas_members")
          .select("board_id, user_id, status")
          .in("board_id", ids)
          .eq("status", "accepted");
        for (const m of (members ?? []) as MemberRow[]) {
          const arr = membersByBoard.get(m.board_id) ?? [];
          arr.push(m.user_id);
          membersByBoard.set(m.board_id, arr);
        }
      }

      return rows.map((b) => ({ ...b, memberIds: membersByBoard.get(b.id) ?? [] }));
    },
  });

  const invitesQuery = useQuery({
    queryKey: ["canvas-invites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canvas_members")
        .select("board_id, user_id, status, invited_by, board:canvas_boards(id, title)")
        .eq("user_id", user!.id)
        .eq("status", "invited");
      if (error) throw error;
      return (data ?? []) as unknown as InviteRow[];
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({
      boardId,
      status,
    }: {
      boardId: string;
      status: "accepted" | "declined";
    }) => {
      const { error } = await supabase
        .from("canvas_members")
        .update({ status })
        .eq("board_id", boardId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: (_data, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["canvas-invites", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["canvas-boards", user?.id] });
      toast.success(status === "accepted" ? "Invite accepted." : "Invite declined.");
    },
    onError: () => toast.error("Could not update the invite."),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const title = newTitle.trim() || "Untitled canvas";
      const { data: board, error } = await supabase
        .from("canvas_boards")
        .insert({ title, created_by: user!.id, snapshot: { strokes: [] } })
        .select("id, title, snapshot, created_by, created_at")
        .single();
      if (error || !board) throw error ?? new Error("No board returned");

      const memberRows = [
        { board_id: board.id, user_id: user!.id, status: "accepted", invited_by: user!.id },
        ...inviteeIds.map((id) => ({
          board_id: board.id,
          user_id: id,
          status: "invited",
          invited_by: user!.id,
        })),
      ];
      const { error: memberErr } = await supabase.from("canvas_members").insert(memberRows);
      if (memberErr) throw memberErr;

      return board as BoardRow;
    },
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ["canvas-boards", user?.id] });
      setDialogOpen(false);
      setNewTitle("");
      setInviteeIds([]);
      toast.success("Canvas created.");
      onOpenBoard({ id: board.id, title: board.title, strokes: [] as Stroke[] });
    },
    onError: () => toast.error("Could not create the canvas."),
  });

  const boards = boardsQuery.data ?? [];
  const invites = invitesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {boards.length} {boards.length === 1 ? "canvas" : "canvases"}
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-1.5" />
              New canvas
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">New collaborative canvas</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Title</label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Sprint retro doodles"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Invite teammates</label>
                <TeamMultiSelect value={inviteeIds} onChange={setInviteeIds} />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="bg-primary text-primary-foreground"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating…" : "Create & open"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            Invites
          </h3>
          <div className="space-y-2">
            {invites.map((inv) => (
              <Card
                key={inv.board_id}
                className="flex items-center gap-3 bg-card/60 border-border/30 rounded-2xl px-4 py-3"
              >
                <Palette className="w-4 h-4 text-primary shrink-0" />
                <p className="flex-1 text-sm text-foreground truncate">
                  {inv.board?.title ?? "A canvas"}
                </p>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground"
                  disabled={respondMutation.isPending}
                  onClick={() =>
                    respondMutation.mutate({ boardId: inv.board_id, status: "accepted" })
                  }
                >
                  <Check className="w-4 h-4 mr-1" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={respondMutation.isPending}
                  onClick={() =>
                    respondMutation.mutate({ boardId: inv.board_id, status: "declined" })
                  }
                >
                  <X className="w-4 h-4 mr-1" />
                  Decline
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Board grid */}
      {boardsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading canvases…</p>
      ) : boards.length === 0 ? (
        <Card className="bg-card/60 border-border/30 rounded-2xl p-10 text-center">
          <Palette className="w-8 h-8 text-muted-foreground/60 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No canvases yet — create one to start doodling with the team.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onOpenBoard({ id: b.id, title: b.title, strokes: [] as Stroke[] })}
              className="text-left"
            >
              <Card className="bg-card/60 border-border/30 rounded-2xl p-5 h-full hover:border-primary/40 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {b.title}
                  </h3>
                  <Palette className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{formatDate(b.created_at)}</p>
                <div className="flex -space-x-2 mt-4">
                  {b.memberIds.slice(0, 5).map((id) => {
                    const m = teamById.get(id);
                    const isMe = id === user?.id;
                    return (
                      <Avatar key={id} className="w-7 h-7 ring-2 ring-background">
                        <AvatarImage src={m?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                          {isMe ? "Me" : initials(m?.name)}
                        </AvatarFallback>
                      </Avatar>
                    );
                  })}
                  {b.memberIds.length > 5 && (
                    <div className="w-7 h-7 rounded-full ring-2 ring-background bg-muted/30 flex items-center justify-center text-[10px] text-muted-foreground">
                      +{b.memberIds.length - 5}
                    </div>
                  )}
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
