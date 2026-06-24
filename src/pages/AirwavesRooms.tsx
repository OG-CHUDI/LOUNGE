import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LiveKitRoom, RoomAudioRenderer, useParticipants, useLocalParticipant, useIsSpeaking,
} from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useTeam, initials } from "@/hooks/useTeam";
import { fetchRoomToken, fetchRoomActivity, LIVEKIT_URL } from "@/lib/livekit";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Headphones, Mic, MicOff, Plus, LogOut, Loader2, Radio } from "lucide-react";

interface RoomRow {
  id: string;
  title: string;
  host_id: string;
  status: string;
  created_at: string | null;
  host: { name: string | null; avatar_url: string | null } | null;
}

type ActiveRoom = { id: string; title: string; hostId: string };

// ── A single participant's avatar with speaking ring ──
function ParticipantChip({ p, profileById }: { p: Participant; profileById: Map<string, { name: string | null; avatar_url: string | null }> }) {
  const speaking = useIsSpeaking(p);
  const prof = profileById.get(p.identity);
  const name = prof?.name ?? p.name ?? "Guest";
  const muted = !p.isMicrophoneEnabled;
  return (
    <div className="flex flex-col items-center gap-1.5 w-20">
      <div className="relative">
        <Avatar className={`w-14 h-14 ring-2 transition-all ${speaking ? "ring-emerald-400" : "ring-border/40"}`}>
          <AvatarImage src={prof?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-indigo-500/20 text-indigo-300">{initials(name)}</AvatarFallback>
        </Avatar>
        <span className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-card flex items-center justify-center ${muted ? "bg-muted" : "bg-emerald-500/90"}`}>
          {muted ? <MicOff className="w-3 h-3 text-foreground/70" /> : <Mic className="w-3 h-3 text-white" />}
        </span>
      </div>
      <span className="text-xs text-foreground truncate max-w-[80px] text-center">{name}</span>
    </div>
  );
}

// ── The in-room stage (rendered inside <LiveKitRoom>) ──
function RoomStage({ title, onLeave }: { title: string; onLeave: () => void }) {
  const participants = useParticipants();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const { data: team } = useTeam();
  const profileById = useMemo(() => {
    const map = new Map<string, { name: string | null; avatar_url: string | null }>();
    (team ?? []).forEach((m) => map.set(m.id, { name: m.name, avatar_url: m.avatar_url }));
    return map;
  }, [team]);

  return (
    <Card className="p-6 bg-card/60 border-border/30 rounded-2xl space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-medium mb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live
        </div>
        <h2 className="font-display text-xl font-bold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {participants.length} {participants.length === 1 ? "person" : "people"} in the room
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        {participants.map((p) => (
          <ParticipantChip key={p.sid} p={p} profileById={profileById} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 pt-2">
        <Button
          variant={isMicrophoneEnabled ? "secondary" : "outline"}
          className="rounded-xl gap-2"
          onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          {isMicrophoneEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          {isMicrophoneEnabled ? "Mute" : "Unmute"}
        </Button>
        <Button variant="outline" className="rounded-xl gap-2" onClick={onLeave}>
          <LogOut className="w-4 h-4" /> Leave
        </Button>
      </div>

      <RoomAudioRenderer />
    </Card>
  );
}

export default function AirwavesRooms() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [active, setActive] = useState<ActiveRoom | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [title, setTitle] = useState("");

  const { data: rooms } = useQuery({
    queryKey: ["voice-rooms"],
    queryFn: async (): Promise<RoomRow[]> => {
      const { data, error } = await supabase
        .from("voice_rooms")
        .select("id, title, host_id, status, created_at, host:profiles!voice_rooms_host_id_fkey(name, avatar_url)")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RoomRow[];
    },
    refetchInterval: 10_000,
  });

  // Live participant counts + stale-room cleanup, polled from LiveKit.
  const { data: activity } = useQuery({
    queryKey: ["voice-room-activity"],
    enabled: !!LIVEKIT_URL && !active,
    queryFn: fetchRoomActivity,
    refetchInterval: 8_000,
  });
  const counts = activity?.counts ?? {};

  useEffect(() => {
    if (activity?.closed?.length) queryClient.invalidateQueries({ queryKey: ["voice-rooms"] });
  }, [activity, queryClient]);

  useEffect(() => {
    const channel = supabase
      .channel("voice-rooms")
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_rooms" }, () =>
        queryClient.invalidateQueries({ queryKey: ["voice-rooms"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const connect = async (room: ActiveRoom) => {
    if (!user) return;
    setActive(room);
    setConnecting(true);
    try {
      const t = await fetchRoomToken(room.id, user.id, profile?.name ?? undefined);
      setToken(t);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't join the room.");
      setActive(null);
    } finally {
      setConnecting(false);
    }
  };

  const startRoom = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const t = title.trim();
      if (!t) throw new Error("Name your room");
      const { data, error } = await supabase
        .from("voice_rooms")
        .insert({ host_id: user.id, title: t, status: "active" })
        .select("id, title, host_id")
        .single();
      if (error) throw error;
      return data as { id: string; title: string; host_id: string };
    },
    onSuccess: (row) => {
      setTitle("");
      queryClient.invalidateQueries({ queryKey: ["voice-rooms"] });
      void connect({ id: row.id, title: row.title, hostId: row.host_id });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't start the room"),
  });

  const leave = () => {
    const room = active;
    setActive(null);
    setToken(null);
    if (room && user && room.hostId === user.id) {
      void supabase
        .from("voice_rooms")
        .update({ status: "closed" })
        .eq("id", room.id)
        .then(() => queryClient.invalidateQueries({ queryKey: ["voice-rooms"] }));
    }
  };

  // ── In a room ──
  if (active && token) {
    return (
      <div className="space-y-6 animate-fade-in">
        <LiveKitRoom
          serverUrl={LIVEKIT_URL}
          token={token}
          connect
          audio
          video={false}
          onDisconnected={leave}
          onError={(e) => toast.error(e.message)}
        >
          <RoomStage title={active.title} onLeave={leave} />
        </LiveKitRoom>
      </div>
    );
  }

  // ── Lobby ──
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Headphones className="w-6 h-6 text-primary" strokeWidth={1.5} /> Drop-in Rooms
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Live voice rooms — open one and the team can hop in to talk. No scheduling, just presence.
        </p>
      </div>

      {!LIVEKIT_URL && (
        <Card className="p-4 bg-amber-500/10 border-amber-500/30 rounded-2xl text-sm text-amber-200">
          Live audio isn't configured yet — set <code className="text-amber-100">VITE_LIVEKIT_URL</code> and deploy the
          <code className="text-amber-100"> livekit-token</code> function.
        </Card>
      )}

      {/* Open a room */}
      <Card className="p-4 bg-card/60 border-border/30 rounded-2xl space-y-3 max-w-xl">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Open a room</h3>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !startRoom.isPending && startRoom.mutate()}
            placeholder="What's it about? e.g. “Coffee & catch-up”"
            maxLength={60}
            className="bg-background/50"
          />
          <Button onClick={() => startRoom.mutate()} disabled={startRoom.isPending || !title.trim() || !LIVEKIT_URL || connecting} className="rounded-xl shrink-0">
            {startRoom.isPending || connecting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
            Start
          </Button>
        </div>
      </Card>

      {/* Live rooms */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Headphones className="w-4 h-4 text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground">Live now</h3>
          <span className="text-xs text-muted-foreground">({rooms?.length ?? 0})</span>
        </div>

        {rooms && rooms.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {rooms.map((r) => (
              <Card key={r.id} className="p-4 bg-card/60 border-border/30 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="w-9 h-9 ring-2 ring-emerald-500/30 shrink-0">
                    <AvatarImage src={r.host?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-emerald-500/20 text-emerald-300 text-xs">{initials(r.host?.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {r.host?.name ?? "Someone"}
                      {(() => {
                        const n = counts[r.id] ?? 0;
                        return n > 0 ? ` · ${n} ${n === 1 ? "person" : "people"}` : " · live";
                      })()}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5 shrink-0"
                  disabled={connecting || !LIVEKIT_URL}
                  onClick={() => connect({ id: r.id, title: r.title, hostId: r.host_id })}
                >
                  <Headphones className="w-3.5 h-3.5" /> Join
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-10 bg-card/40 border-border/20 text-center">
            <Radio className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No rooms live right now. Open one and the team can join you.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
