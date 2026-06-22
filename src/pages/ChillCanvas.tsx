import { useState } from "react";
import BoardList from "@/components/canvas/BoardList";
import CanvasBoard from "@/components/canvas/CanvasBoard";
import type { Stroke } from "@/components/canvas/useBoardRealtime";

interface OpenBoard {
  id: string;
  title: string;
  strokes: Stroke[];
}

export default function ChillCanvas() {
  const [openBoard, setOpenBoard] = useState<OpenBoard | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Collaborative Canvas</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Spin up a board, invite the team, and draw together.
        </p>
      </div>

      {openBoard ? (
        <CanvasBoard
          key={openBoard.id}
          boardId={openBoard.id}
          title={openBoard.title}
          initialStrokes={openBoard.strokes}
          onBack={() => setOpenBoard(null)}
        />
      ) : (
        <BoardList onOpenBoard={setOpenBoard} />
      )}
    </div>
  );
}
