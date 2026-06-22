import { petSvgString } from "@/lib/pet-art";
import type { Accessories } from "@/lib/pets";
import { cn } from "@/lib/utils";

interface PetAvatarProps {
  species: string;
  stage: number; // 0..3
  accessories?: Accessories;
  size?: number; // px
  float?: boolean;
  className?: string;
}

/** Renders a pet as a flat-vector SVG illustration with accessory overlays. */
export default function PetAvatar({
  species,
  stage,
  accessories = {},
  size = 160,
  float = false,
  className,
}: PetAvatarProps) {
  const svg = petSvgString(species, stage, accessories);
  return (
    <div
      className={cn("relative select-none", float && "animate-float", className)}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Rasterise a pet (with accessories) to a PNG data URL for use as a PFP. */
export function renderPetToDataURL(
  species: string,
  stage: number,
  accessories: Accessories = {},
  size = 256
): Promise<string> {
  const svg = petSvgString(species, stage, accessories, { bg: "#134f5c" });
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas context"));
      ctx.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("svg render failed"));
    img.src = url;
  });
}
