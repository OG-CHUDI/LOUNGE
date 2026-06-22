import { useState } from "react";
import WallList from "@/components/memes/WallList";
import MemeWall, { type Wall } from "@/components/memes/MemeWall";

export default function ChillMemes() {
  const [activeWall, setActiveWall] = useState<Wall | null>(null);

  if (activeWall) {
    return <MemeWall wall={activeWall} onBack={() => setActiveWall(null)} />;
  }

  return <WallList onOpen={setActiveWall} />;
}
