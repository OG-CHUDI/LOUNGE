// Desk-pet definitions. Pets are mini-animals or flowers, drawn as flat SVG
// illustrations (see lib/pet-art.ts) — no emoji. Growth is driven by days
// active (the daily login grant in auth.tsx); raw XP is never shown.

export type PetKind = "animal" | "flower";

export interface Species {
  id: string;
  name: string;
  kind: PetKind;
  /** Art template in pet-art.ts. */
  template: "bird" | "penguin" | "cat" | "fox" | "bunny" | "flower" | "tulip" | "cactus";
  colors: Record<string, string>;
}

export const SPECIES: Species[] = [
  { id: "chick",     name: "Chick",     kind: "animal", template: "bird",
    colors: { body: "#FBBF24", belly: "#FDE68A", beak: "#FB923C" } },
  { id: "duckling",  name: "Duckling",  kind: "animal", template: "bird",
    colors: { body: "#FCD34D", belly: "#FEF3C7", beak: "#FB923C" } },
  { id: "penguin",   name: "Penguin",   kind: "animal", template: "penguin",
    colors: { body: "#334155", belly: "#F1F5F9", beak: "#FB923C" } },
  { id: "cat",       name: "Kitten",    kind: "animal", template: "cat",
    colors: { body: "#F4A45E", belly: "#FFE8D2", nose: "#F472B6" } },
  { id: "fox",       name: "Fox Kit",   kind: "animal", template: "fox",
    colors: { body: "#F97316", belly: "#FFF7ED", ear: "#C2410C", nose: "#1F2937" } },
  { id: "bunny",     name: "Bunny",     kind: "animal", template: "bunny",
    colors: { body: "#E5E7EB", belly: "#FFFFFF", inner: "#FBCFE8", nose: "#F472B6" } },
  { id: "sunflower", name: "Sunflower", kind: "flower", template: "flower",
    colors: { petal: "#FBBF24", center: "#92400E", stem: "#22C55E" } },
  { id: "tulip",     name: "Tulip",     kind: "flower", template: "tulip",
    colors: { petal: "#F472B6", stem: "#22C55E" } },
  { id: "rose",      name: "Rose",      kind: "flower", template: "flower",
    colors: { petal: "#FB7185", center: "#9F1239", stem: "#16A34A" } },
  { id: "cactus",    name: "Cactus",    kind: "flower", template: "cactus",
    colors: { body: "#4ADE80", pot: "#D98152", potRim: "#C26B3F", flower: "#F472B6" } },
];

export const speciesById = (id?: string | null) =>
  SPECIES.find((s) => s.id === id) ?? SPECIES[0];

export const STAGE_LABELS = ["Baby", "Young", "Grown", "Full"] as const;

// ── Accessories — render as SVG overlays once the pet has grown ─────────
export interface AccessoryOption {
  id: string;
  label: string;
}
export type AccessorySlot = "hat" | "face" | "feet";

export const ACCESSORIES: Record<AccessorySlot, AccessoryOption[]> = {
  hat: [
    { id: "none", label: "None" },
    { id: "tophat", label: "Top Hat" },
    { id: "crown", label: "Crown" },
    { id: "cap", label: "Cap" },
    { id: "party", label: "Party Hat" },
  ],
  face: [
    { id: "none", label: "None" },
    { id: "sunglasses", label: "Sunglasses" },
    { id: "glasses", label: "Glasses" },
    { id: "bow", label: "Bow" },
  ],
  feet: [
    { id: "none", label: "None" },
    { id: "boots", label: "Boots" },
    { id: "sneakers", label: "Sneakers" },
  ],
};

export type Accessories = Partial<Record<AccessorySlot, string>>;

// ── Growth + happiness maths ────────────────────────────────────────────
export const GROWN_AFTER_DAYS = 10;

/** 0..3 from hidden XP — ~10 days of logins reaches "grown" (stage 2). */
export function stageIndex(xp: number): number {
  if (xp >= 200) return 3;
  if (xp >= 80) return 2;
  if (xp >= 20) return 1;
  return 0;
}

export function daysBetween(from: string | null | undefined, to = new Date()): number {
  if (!from) return 0;
  const d = new Date(from);
  return Math.floor((to.getTime() - d.getTime()) / 86_400_000);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A pet can be fed & dressed up once it's been growing for ~10 days. */
export function isGrown(xp: number, adoptedOn: string | null | undefined): boolean {
  return stageIndex(xp) >= 2 || daysBetween(adoptedOn) >= GROWN_AFTER_DAYS;
}

/** Happiness decays 15/day since last fed; full when fed today. */
export function currentHappiness(fedOn: string | null | undefined): number {
  if (!fedOn) return 70;
  if (fedOn.slice(0, 10) === todayISO()) return 100;
  return Math.max(0, 100 - daysBetween(fedOn) * 15);
}

export function fedToday(fedOn: string | null | undefined): boolean {
  return !!fedOn && fedOn.slice(0, 10) === todayISO();
}
