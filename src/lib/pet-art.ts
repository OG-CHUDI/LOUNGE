// Flat-vector pet illustrations. Pets are drawn as SVG (no emoji) so they read
// as designed characters, scale crisply, and can be rasterised for a PFP.
// `petSvgString` is the single source of truth — used both by the <PetAvatar>
// component (via innerHTML) and the PNG exporter.

import { speciesById, type Accessories, type AccessorySlot } from "./pets";

const EYE = "#23262e";

function eyes(lx: number, rx: number, y: number, r = 5): string {
  return (
    `<circle cx="${lx}" cy="${y}" r="${r}" fill="${EYE}"/>` +
    `<circle cx="${rx}" cy="${y}" r="${r}" fill="${EYE}"/>` +
    `<circle cx="${lx + 1.4}" cy="${y - 1.5}" r="${r * 0.34}" fill="#fff"/>` +
    `<circle cx="${rx + 1.4}" cy="${y - 1.5}" r="${r * 0.34}" fill="#fff"/>`
  );
}

const scaled = (markup: string, s: number) =>
  `<g transform="translate(60,74) scale(${s}) translate(-60,-74)">${markup}</g>`;

// ── Creature bodies (drawn around centre ~ (60,74)) ─────────────────────
type Colors = Record<string, string>;

function bird(c: Colors): string {
  return (
    `<ellipse cx="60" cy="76" rx="32" ry="31" fill="${c.body}"/>` +
    `<ellipse cx="60" cy="84" rx="17" ry="16" fill="${c.belly}"/>` +
    `<path d="M40 78 q-7 6 -3 16 q8 -2 5 -15 z" fill="${c.body}"/>` +
    `<polygon points="53,70 67,70 60,78" fill="${c.beak}"/>` +
    eyes(51, 69, 63) +
    `<path d="M60 41 q-3 -7 1 -10 q4 3 1 10" fill="${c.body}"/>` +
    `<g stroke="${c.beak}" stroke-width="2.4" stroke-linecap="round"><path d="M50 106 l-4 5 M50 106 v6 M50 106 l4 5"/><path d="M70 106 l-4 5 M70 106 v6 M70 106 l4 5"/></g>`
  );
}

function penguin(c: Colors): string {
  return (
    `<ellipse cx="60" cy="74" rx="30" ry="33" fill="${c.body}"/>` +
    `<ellipse cx="60" cy="80" rx="18" ry="22" fill="${c.belly}"/>` +
    `<path d="M30 70 q-6 14 4 22 q4 -14 -2 -22 z" fill="${c.body}"/>` +
    `<path d="M90 70 q6 14 -4 22 q-4 -14 2 -22 z" fill="${c.body}"/>` +
    `<polygon points="54,62 66,62 60,71" fill="${c.beak}"/>` +
    eyes(52, 68, 54, 4.5) +
    `<ellipse cx="51" cy="107" rx="8" ry="3.5" fill="${c.beak}"/>` +
    `<ellipse cx="69" cy="107" rx="8" ry="3.5" fill="${c.beak}"/>`
  );
}

function cat(c: Colors): string {
  return (
    `<polygon points="36,48 46,26 56,46" fill="${c.body}"/>` +
    `<polygon points="84,48 74,26 64,46" fill="${c.body}"/>` +
    `<polygon points="41,46 46,32 51,45" fill="${c.nose}"/>` +
    `<polygon points="79,46 74,32 69,45" fill="${c.nose}"/>` +
    `<ellipse cx="60" cy="74" rx="32" ry="30" fill="${c.body}"/>` +
    `<ellipse cx="60" cy="82" rx="17" ry="15" fill="${c.belly}"/>` +
    eyes(50, 70, 70) +
    `<polygon points="56,77 64,77 60,82" fill="${c.nose}"/>` +
    `<path d="M60 82 q-4 4 -9 2 M60 82 q4 4 9 2" stroke="#8a6a4a" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<g stroke="#8a6a4a" stroke-width="1.3" stroke-linecap="round"><path d="M30 72 h14 M30 78 h14 M90 72 h-14 M90 78 h-14"/></g>`
  );
}

function fox(c: Colors): string {
  return (
    `<polygon points="34,50 42,24 54,46" fill="${c.body}"/>` +
    `<polygon points="35,46 41,30 48,45" fill="${c.ear}"/>` +
    `<polygon points="86,50 78,24 66,46" fill="${c.body}"/>` +
    `<polygon points="85,46 79,30 72,45" fill="${c.ear}"/>` +
    `<ellipse cx="60" cy="74" rx="31" ry="29" fill="${c.body}"/>` +
    `<path d="M60 64 q-16 6 -16 22 q0 14 16 16 q16 -2 16 -16 q0 -16 -16 -22 z" fill="${c.belly}"/>` +
    eyes(50, 70, 68) +
    `<ellipse cx="60" cy="84" rx="4.5" ry="3.5" fill="${c.nose}"/>`
  );
}

function bunny(c: Colors): string {
  return (
    `<ellipse cx="50" cy="34" rx="7" ry="21" fill="${c.body}"/>` +
    `<ellipse cx="50" cy="36" rx="3" ry="15" fill="${c.inner}"/>` +
    `<ellipse cx="70" cy="34" rx="7" ry="21" fill="${c.body}"/>` +
    `<ellipse cx="70" cy="36" rx="3" ry="15" fill="${c.inner}"/>` +
    `<ellipse cx="60" cy="76" rx="30" ry="29" fill="${c.body}"/>` +
    `<ellipse cx="60" cy="84" rx="16" ry="14" fill="${c.belly}"/>` +
    eyes(50, 70, 70) +
    `<ellipse cx="60" cy="80" rx="3.5" ry="2.5" fill="${c.nose}"/>` +
    `<path d="M60 82 v3" stroke="#9b6a78" stroke-width="1.4" stroke-linecap="round"/>`
  );
}

function flower(c: Colors): string {
  let petals = "";
  for (let i = 0; i < 10; i++) {
    petals += `<g transform="rotate(${i * 36} 60 48)"><ellipse cx="60" cy="30" rx="6.5" ry="13" fill="${c.petal}"/></g>`;
  }
  return (
    `<rect x="57" y="58" width="6" height="48" rx="3" fill="${c.stem}"/>` +
    `<path d="M60 82 q-20 -2 -24 -16 q18 -2 24 12 z" fill="${c.stem}"/>` +
    `<path d="M60 92 q20 -2 24 -16 q-18 -2 -24 12 z" fill="${c.stem}"/>` +
    petals +
    `<circle cx="60" cy="48" r="15" fill="${c.center}"/>` +
    eyes(55, 65, 47, 3.4) +
    `<path d="M55 53 q5 4 10 0" stroke="#3b2a1a" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
  );
}

function tulip(c: Colors): string {
  return (
    `<rect x="57" y="56" width="6" height="50" rx="3" fill="${c.stem}"/>` +
    `<path d="M60 84 q-20 -2 -24 -16 q18 -2 24 12 z" fill="${c.stem}"/>` +
    `<path d="M42 52 q18 -30 36 0 q-2 12 -18 12 q-16 0 -18 -12 z" fill="${c.petal}"/>` +
    `<path d="M60 40 v22 M50 46 q4 14 10 16 M70 46 q-4 14 -10 16" stroke="rgba(0,0,0,0.12)" stroke-width="2" fill="none"/>` +
    eyes(54, 66, 50, 3.2) +
    `<path d="M55 56 q5 3 10 0" stroke="rgba(0,0,0,0.3)" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
  );
}

function cactus(c: Colors): string {
  return (
    `<path d="M45 88 L49 110 L71 110 L75 88 Z" fill="${c.pot}"/>` +
    `<rect x="42" y="84" width="36" height="8" rx="2" fill="${c.potRim}"/>` +
    `<rect x="51" y="40" width="18" height="50" rx="9" fill="${c.body}"/>` +
    `<path d="M51 62 h-9 a6 6 0 0 0 -6 6 v8 a4 4 0 0 0 8 0 v-6 h7 z" fill="${c.body}"/>` +
    `<path d="M69 56 h9 a6 6 0 0 1 6 6 v10 a4 4 0 0 1 -8 0 v-8 h-7 z" fill="${c.body}"/>` +
    `<circle cx="60" cy="40" r="6" fill="${c.flower}"/>` +
    eyes(55, 65, 58, 3.4) +
    `<path d="M55 64 q5 3 10 0" stroke="#15803d" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
  );
}

const TEMPLATES: Record<string, (c: Colors) => string> = {
  bird,
  penguin,
  cat,
  fox,
  bunny,
  flower,
  tulip,
  cactus,
};

function eggMarkup(): string {
  return (
    `<ellipse cx="60" cy="66" rx="30" ry="38" fill="#FBEFE0"/>` +
    `<ellipse cx="60" cy="66" rx="30" ry="38" fill="#F4DCC3" opacity="0.5" transform="translate(4 6)"/>` +
    `<ellipse cx="50" cy="54" rx="6" ry="8" fill="#fff" opacity="0.55"/>` +
    `<circle cx="48" cy="78" r="3" fill="#E8C9A6"/><circle cx="70" cy="70" r="2.5" fill="#E8C9A6"/><circle cx="66" cy="86" r="2" fill="#E8C9A6"/>`
  );
}

function sproutMarkup(c: Colors): string {
  return (
    `<path d="M30 100 q30 -12 60 0 z" fill="#6B4A2B"/>` +
    `<path d="M40 100 q30 -8 40 0 z" fill="#8A623B"/>` +
    `<rect x="58" y="74" width="4" height="26" rx="2" fill="${c.stem ?? "#22C55E"}"/>` +
    `<path d="M60 86 q-12 -2 -15 -11 q11 -1 15 7 z" fill="${c.stem ?? "#22C55E"}"/>` +
    `<path d="M60 90 q12 -2 15 -11 q-11 -1 -15 7 z" fill="${c.stem ?? "#22C55E"}"/>`
  );
}

function stemMarkup(c: Colors): string {
  return (
    `<path d="M34 102 q26 -10 52 0 z" fill="#6B4A2B"/>` +
    `<rect x="57" y="56" width="6" height="46" rx="3" fill="${c.stem ?? "#22C55E"}"/>` +
    `<path d="M60 78 q-16 -3 -20 -14 q15 -2 20 9 z" fill="${c.stem ?? "#22C55E"}"/>` +
    `<path d="M60 88 q16 -3 20 -14 q-15 -2 -20 9 z" fill="${c.stem ?? "#22C55E"}"/>` +
    `<circle cx="60" cy="52" r="6" fill="${c.petal ?? c.flower ?? "#84CC16"}"/>`
  );
}

// ── Accessories (drawn over the grown creature) ─────────────────────────
const ACC_MARKUP: Record<AccessorySlot, Record<string, string>> = {
  hat: {
    tophat:
      `<rect x="44" y="20" width="32" height="18" rx="2" fill="#1f2430"/>` +
      `<rect x="46" y="32" width="28" height="5" fill="#E04848"/>` +
      `<rect x="36" y="37" width="48" height="6" rx="3" fill="#11141c"/>`,
    crown:
      `<polygon points="42,42 46,26 54,35 60,24 66,35 74,26 78,42" fill="#FBBF24" stroke="#D97706" stroke-width="1.2"/>` +
      `<circle cx="60" cy="26" r="2.4" fill="#EF4444"/><rect x="42" y="40" width="36" height="4" rx="2" fill="#F59E0B"/>`,
    cap:
      `<path d="M40 42 a20 17 0 0 1 40 0 z" fill="#2563EB"/>` +
      `<path d="M58 42 q22 -2 26 4 q-4 4 -26 1 z" fill="#1D4ED8"/>`,
    party:
      `<polygon points="60,14 49,44 71,44" fill="#A855F7"/>` +
      `<polygon points="60,14 49,44 71,44" fill="#fff" opacity="0.18"/>` +
      `<circle cx="60" cy="14" r="3.2" fill="#FBBF24"/>` +
      `<circle cx="55" cy="30" r="1.8" fill="#FDE047"/><circle cx="64" cy="38" r="1.8" fill="#34D399"/>`,
  },
  face: {
    sunglasses:
      `<g fill="#14171f"><rect x="42" y="56" width="16" height="12" rx="4"/><rect x="62" y="56" width="16" height="12" rx="4"/><rect x="58" y="59" width="4" height="3"/></g>` +
      `<rect x="44" y="58" width="5" height="3" rx="1.5" fill="#3b4252"/>`,
    glasses:
      `<g fill="none" stroke="#14171f" stroke-width="2.4"><circle cx="50" cy="62" r="8.5"/><circle cx="70" cy="62" r="8.5"/><line x1="58.5" y1="62" x2="61.5" y2="62"/></g>`,
    bow:
      `<g fill="#F472B6"><path d="M60 36 l-11 -6 v13 z"/><path d="M60 36 l11 -6 v13 z"/></g><circle cx="60" cy="36" r="3.4" fill="#DB2777"/>`,
  },
  feet: {
    boots:
      `<g fill="#6B3F1D"><path d="M40 96 h13 v7 q0 4 -4 4 h-9 q-4 0 -4 -4 v-3 q4 0 4 -4 z"/><path d="M67 96 h13 v7 q0 4 -4 4 h-9 q-4 0 -4 -4 v-3 q4 0 4 -4 z"/></g>`,
    sneakers:
      `<g fill="#F4F5F7" stroke="#C2C7D0" stroke-width="1"><rect x="38" y="100" width="16" height="9" rx="4.5"/><rect x="66" y="100" width="16" height="9" rx="4.5"/></g>` +
      `<g stroke="#C2C7D0" stroke-width="1"><line x1="44" y1="102" x2="50" y2="102"/><line x1="72" y1="102" x2="78" y2="102"/></g>`,
  },
};

function accessoriesMarkup(acc: Accessories): string {
  let out = "";
  (Object.keys(ACC_MARKUP) as AccessorySlot[]).forEach((slot) => {
    const id = acc[slot];
    if (id && id !== "none" && ACC_MARKUP[slot][id]) out += ACC_MARKUP[slot][id];
  });
  return out;
}

export interface PetSvgOpts {
  /** Background circle colour (used for the rasterised PFP). */
  bg?: string;
}

// Tight viewBoxes so each accessory fills its picker-button preview.
const SLOT_VIEWBOX: Record<AccessorySlot, string> = {
  hat: "34 12 52 34",
  face: "38 50 44 22",
  feet: "34 94 52 18",
};

/** A small standalone SVG of one accessory, for the customisation buttons. */
export function accessoryPreviewSvgString(slot: AccessorySlot, id: string): string {
  const m = ACC_MARKUP[slot]?.[id] ?? "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SLOT_VIEWBOX[slot]}" width="100%" height="100%">${m}</svg>`;
}

export function petSvgString(
  speciesId: string,
  stage: number,
  acc: Accessories = {},
  opts: PetSvgOpts = {}
): string {
  const sp = speciesById(speciesId);
  const c = sp.colors;
  const t = sp.template;
  const eggSpecies = t === "bird" || t === "penguin";
  const isPlant = t === "flower" || t === "tulip" || t === "cactus";
  const render = TEMPLATES[t] ?? bird;

  let inner = "";
  if (stage <= 0) {
    inner = eggSpecies ? eggMarkup() : isPlant ? sproutMarkup(c) : scaled(render(c), 0.52);
  } else if (stage === 1) {
    inner = isPlant ? stemMarkup(c) : scaled(render(c), 0.72);
  } else {
    inner = scaled(render(c), stage === 2 ? 0.9 : 1);
  }

  const acc2 = stage >= 2 ? accessoriesMarkup(acc) : "";
  const bg = opts.bg ? `<circle cx="60" cy="60" r="60" fill="${opts.bg}"/>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="100%" height="100%">${bg}${inner}${acc2}</svg>`;
}
