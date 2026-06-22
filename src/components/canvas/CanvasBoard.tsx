import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/hooks/useTeam";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eraser,
  Maximize2,
  Minimize2,
  Trash2,
  Users,
} from "lucide-react";
import {
  useBoardRealtime,
  type PresenceUser,
  type Stroke,
  type StrokePoint,
} from "./useBoardRealtime";

const COLOURS = [
  "#f8fafc", // near-white
  "#f472b6", // pink
  "#a78bfa", // violet (primary-ish)
  "#60a5fa", // blue
  "#34d399", // green
  "#fbbf24", // amber
];

// Brush sizes as a fraction of the smaller board dimension (so they scale).
const BRUSH_SIZES = {
  small: 0.004,
  med: 0.009,
  large: 0.018,
} as const;
type BrushKey = keyof typeof BRUSH_SIZES;

// Strokes are persisted as append-only rows in `canvas_strokes`, so queries go
// through an untyped client.
const db = supabase as any;

function genId() {
  return crypto.randomUUID();
}

export default function CanvasBoard({
  boardId,
  title,
  onBack,
}: {
  boardId: string;
  title: string;
  /**
   * Deprecated: strokes are now loaded from the append-only `canvas_strokes`
   * table on open, so any value passed here is ignored. Kept optional for
   * backwards compatibility with existing callers.
   */
  initialStrokes?: Stroke[];
  onBack: () => void;
}) {
  const { user, profile } = useAuth();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Strokes are the source of truth for what's drawn. Held in a ref so the
  // pointer handlers and realtime callbacks always see the latest list without
  // re-binding listeners on every change.
  const strokesRef = useRef<Stroke[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const drawingRef = useRef(false);

  // Stable ids of every stroke we've already drawn. The same stroke can reach us
  // via both the broadcast channel and the postgres_changes INSERT, so we dedupe
  // on id to draw it only once.
  const drawnIdsRef = useRef<Set<string>>(new Set());

  const [color, setColor] = useState<string>(COLOURS[2]);
  const [brush, setBrush] = useState<BrushKey>("med");
  const [erasing, setErasing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const me: PresenceUser = useMemo(
    () => ({
      user_id: user?.id ?? "anon",
      name: profile?.name ?? "You",
      avatar_url: profile?.avatar_url ?? null,
    }),
    [user?.id, profile?.name, profile?.avatar_url],
  );

  // ---- rendering -----------------------------------------------------------

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke, w: number, h: number) => {
    if (stroke.points.length === 0) return;
    const minDim = Math.min(w, h);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, stroke.size * minDim);
    if (stroke.color === null) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = stroke.color;
    }
    ctx.beginPath();
    const first = stroke.points[0];
    ctx.moveTo(first.x * w, first.y * h);
    if (stroke.points.length === 1) {
      // A dot: draw a tiny line to itself so lineCap renders a round point.
      ctx.lineTo(first.x * w + 0.01, first.y * h + 0.01);
    } else {
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h);
      }
    }
    ctx.stroke();
    ctx.restore();
  }, []);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke, w, h);
  }, [drawStroke]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawAll();
  }, [redrawAll]);

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(() => resizeCanvas());
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", resizeCanvas);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [resizeCanvas]);

  // ---- realtime ------------------------------------------------------------

  const handleRemoteStroke = useCallback(
    (stroke: Stroke) => {
      // Dedupe: a stroke may arrive via both broadcast and postgres_changes.
      if (!stroke?.id || drawnIdsRef.current.has(stroke.id)) return;
      drawnIdsRef.current.add(stroke.id);
      strokesRef.current = [...strokesRef.current, stroke];
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const dpr = window.devicePixelRatio || 1;
        drawStroke(ctx, stroke, canvas.width / dpr, canvas.height / dpr);
      }
    },
    [drawStroke],
  );

  const handleRemoteClear = useCallback(() => {
    strokesRef.current = [];
    drawnIdsRef.current.clear();
    redrawAll();
  }, [redrawAll]);

  const { presence, broadcastStroke, broadcastClear } = useBoardRealtime({
    boardId,
    me,
    onRemoteStroke: handleRemoteStroke,
    onRemoteClear: handleRemoteClear,
  });

  // ---- persistence / load --------------------------------------------------

  // Load all persisted strokes for this board (append-only rows, ordered by
  // insertion time) and render them. Existing boards with no rows start empty.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await db
        .from("canvas_strokes")
        .select("id, stroke")
        .eq("board_id", boardId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error("Could not load the canvas.");
        return;
      }
      const strokes: Stroke[] = [];
      const ids = new Set<string>();
      for (const row of (data ?? []) as { id: string; stroke: Stroke }[]) {
        const stroke = row.stroke;
        if (!stroke?.id || ids.has(stroke.id)) continue;
        ids.add(stroke.id);
        strokes.push(stroke);
      }
      strokesRef.current = strokes;
      drawnIdsRef.current = ids;
      redrawAll();
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId, redrawAll]);

  // Persist a single completed stroke as its own row. Append-only inserts mean
  // concurrent authors never clobber each other (no last-writer-wins).
  const persistStroke = useCallback(
    async (stroke: Stroke) => {
      if (!user) return;
      const { error } = await db
        .from("canvas_strokes")
        .insert({ board_id: boardId, author_id: user.id, stroke });
      if (error) toast.error("Could not save the canvas.");
    },
    [boardId, user],
  );

  // ---- pointer handling ----------------------------------------------------

  const pointToNorm = (e: React.PointerEvent): StrokePoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const pt = pointToNorm(e);
    if (!pt) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    activeStrokeRef.current = {
      id: genId(),
      color: erasing ? null : color,
      size: BRUSH_SIZES[brush],
      points: [pt],
    };
    drawIncremental();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current || !activeStrokeRef.current) return;
    const pt = pointToNorm(e);
    if (!pt) return;
    activeStrokeRef.current.points.push(pt);
    drawIncremental();
  };

  // Draw the in-progress stroke. We redraw the whole active stroke each move
  // (cheap for a single stroke) so eraser composition stays correct.
  const drawIncremental = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const stroke = activeStrokeRef.current;
    if (!canvas || !ctx || !stroke) return;
    const dpr = window.devicePixelRatio || 1;
    drawStroke(ctx, stroke, canvas.width / dpr, canvas.height / dpr);
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const stroke = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if (!stroke || stroke.points.length === 0) return;
    drawnIdsRef.current.add(stroke.id);
    strokesRef.current = [...strokesRef.current, stroke];
    broadcastStroke(stroke);
    void persistStroke(stroke);
  };

  const onPointerUp = () => finishStroke();

  // ---- toolbar actions -----------------------------------------------------

  const handleClear = async () => {
    strokesRef.current = [];
    drawnIdsRef.current.clear();
    redrawAll();
    broadcastClear();
    const { error } = await db.from("canvas_strokes").delete().eq("board_id", boardId);
    if (error) toast.error("Could not clear the canvas.");
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      toast.error("Fullscreen is not available.");
    }
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ---- UI ------------------------------------------------------------------

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to boards
        </Button>
        <h3 className="font-display text-lg font-semibold text-foreground truncate">{title}</h3>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{presence.length} drawing</span>
          </div>
          <div className="flex -space-x-2">
            {presence.slice(0, 6).map((p) => (
              <Avatar key={p.user_id} className="w-7 h-7 ring-2 ring-background">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                  {initials(p.name)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/30 bg-card/60 px-4 py-3">
        <div className="flex items-center gap-2">
          {COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              onClick={() => {
                setColor(c);
                setErasing(false);
              }}
              className={`w-6 h-6 rounded-full ring-2 transition-transform hover:scale-110 ${
                !erasing && color === c ? "ring-foreground" : "ring-border/40"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="h-5 w-px bg-border/40" />

        <div className="flex items-center gap-1">
          {(Object.keys(BRUSH_SIZES) as BrushKey[]).map((key) => (
            <Button
              key={key}
              variant={brush === key ? "default" : "outline"}
              size="sm"
              className="capitalize"
              onClick={() => setBrush(key)}
            >
              {key}
            </Button>
          ))}
        </div>

        <div className="h-5 w-px bg-border/40" />

        <Button
          variant={erasing ? "default" : "outline"}
          size="sm"
          onClick={() => setErasing((v) => !v)}
        >
          <Eraser className="w-4 h-4 mr-1.5" />
          Eraser
        </Button>

        <Button variant="outline" size="sm" onClick={handleClear} className="ml-auto">
          <Trash2 className="w-4 h-4 mr-1.5" />
          Clear
        </Button>
      </div>

      {/* Drawing surface */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl border border-border/30 bg-card/60 overflow-hidden touch-none"
        style={{ height: isFullscreen ? "100vh" : "min(70vh, 640px)" }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full cursor-crosshair touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    </div>
  );
}
