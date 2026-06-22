import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import PetAvatar, { renderPetToDataURL } from "@/components/PetAvatar";
import { accessoryPreviewSvgString } from "@/lib/pet-art";
import { uploadToBucket, dataUrlToBlob } from "@/lib/storage";
import {
  SPECIES,
  STAGE_LABELS,
  ACCESSORIES,
  speciesById,
  stageIndex,
  isGrown,
  fedToday,
  currentHappiness,
  daysBetween,
  todayISO,
  type Accessories,
  type AccessorySlot,
} from "@/lib/pets";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Heart,
  Sparkles,
  Lock,
  Loader2,
  ImageUp,
  Drumstick,
  Palette,
  Check,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STAGE_THRESHOLDS = [0, 20, 80, 200];

export default function ChillPets() {
  const { user, deskPet, profile, refreshProfile } = useAuth();

  // Local working copy so the UI updates instantly; persisted to Supabase.
  const [pet, setPet] = useState(deskPet);
  useEffect(() => setPet(deskPet), [deskPet]);

  // Adoption form
  const [chosenSpecies, setChosenSpecies] = useState(SPECIES[0].id);
  const [petName, setPetName] = useState("");
  const [adopting, setAdopting] = useState(false);

  const [feeding, setFeeding] = useState(false);
  const [savingPfp, setSavingPfp] = useState(false);

  const xp = pet?.xp ?? 0;
  const stage = stageIndex(xp);
  const grown = pet ? isGrown(xp, pet.adopted_on) : false;
  const accessories = (pet?.accessories ?? {}) as Accessories;
  const happiness = currentHappiness(pet?.fed_on);
  const canFeed = grown && !fedToday(pet?.fed_on);
  const ageDays = daysBetween(pet?.adopted_on);

  // Progress to next growth stage (no raw XP shown).
  const nextThreshold = STAGE_THRESHOLDS[Math.min(stage + 1, 3)];
  const prevThreshold = STAGE_THRESHOLDS[stage];
  const growthPct =
    stage >= 3 ? 100 : Math.round(((xp - prevThreshold) / (nextThreshold - prevThreshold)) * 100);

  const isAdopted = !!pet?.pet_name;

  async function patchPet(patch: Record<string, unknown>) {
    if (!user) return;
    setPet((p) => (p ? ({ ...p, ...patch } as typeof p) : p));
    const { error } = await supabase.from("desk_pets").update(patch).eq("user_id", user.id);
    if (error) {
      toast.error("Couldn't save — try again.");
      throw error;
    }
  }

  async function handleAdopt() {
    if (!petName.trim()) {
      toast.error("Give your pet a name first!");
      return;
    }
    setAdopting(true);
    try {
      await patchPet({
        species: chosenSpecies,
        pet_name: petName.trim(),
        adopted_on: todayISO(),
        xp: 0,
        stage: "egg",
        accessories: {},
      });
      await refreshProfile();
      toast.success(`${petName.trim()} has been adopted!`);
    } catch {
      /* handled in patchPet */
    } finally {
      setAdopting(false);
    }
  }

  async function handleFeed() {
    setFeeding(true);
    try {
      await patchPet({ fed_on: todayISO(), happiness: 100 });
      toast.success(`${pet?.pet_name} is happy and full!`);
    } catch {
      /* handled */
    } finally {
      setFeeding(false);
    }
  }

  function setAccessory(slot: AccessorySlot, id: string) {
    const next = { ...accessories, [slot]: id };
    patchPet({ accessories: next }).catch(() => {});
  }

  async function handleSetPfp() {
    if (!user || !pet) return;
    setSavingPfp(true);
    try {
      const dataUrl = await renderPetToDataURL(pet.species ?? "chick", stage, accessories, 256);
      const blob = dataUrlToBlob(dataUrl);
      const url = await uploadToBucket("avatars", `${user.id}/pet-${Date.now()}.png`, blob, "image/png");
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Your pet is now your profile picture!");
    } catch (e) {
      toast.error("Couldn't set profile picture.");
    } finally {
      setSavingPfp(false);
    }
  }

  if (!pet) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your pet…
      </div>
    );
  }

  // ── Adoption flow ─────────────────────────────────────────────────────
  if (!isAdopted) {
    const sp = speciesById(chosenSpecies);
    return (
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Adopt your desk pet</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a companion — a mini-animal or a flower. It grows the more you show up. After about{" "}
            {10} days you can feed and dress it up.
          </p>
        </div>

        <Card className="p-6 bg-card/60 border-border/30">
          <div className="flex flex-col items-center mb-6">
            <PetAvatar species={chosenSpecies} stage={2} size={120} float />
            <p className="mt-2 text-sm text-muted-foreground">
              {sp.name} · {sp.kind === "flower" ? "Flower" : "Mini-animal"}
            </p>
          </div>

          <p className="text-xs font-medium text-muted-foreground mb-2">Choose a species</p>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mb-5">
            {SPECIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setChosenSpecies(s.id)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-xl border transition-all",
                  chosenSpecies === s.id
                    ? "border-primary bg-primary/10"
                    : "border-border/30 hover:bg-muted/10"
                )}
              >
                <PetAvatar species={s.id} stage={2} size={44} />
                <span className="text-[10px] text-muted-foreground">{s.name}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              placeholder="Name your pet…"
              maxLength={24}
              className="flex-1 h-11 rounded-xl bg-background/50 border-border/40"
            />
            <Button onClick={handleAdopt} disabled={adopting} className="h-11 rounded-xl px-6">
              {adopting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Adopt <Sparkles className="w-4 h-4 ml-1.5" /></>}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Pet home ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Desk Pet</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Show up to help {pet.pet_name} grow{grown ? ", keep it fed, and dress it up." : "."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pet display */}
        <Card className="p-8 bg-card/60 border-border/30 flex flex-col items-center">
          <div className="relative">
            <div className="w-52 h-52 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/5 border border-border/30 flex items-center justify-center">
              <PetAvatar species={pet.species ?? "chick"} stage={stage} accessories={accessories} size={180} float />
            </div>
            <span className="absolute -top-2 -right-2 px-2.5 py-1 rounded-full bg-primary/20 text-primary text-[11px] font-medium border border-primary/30">
              {STAGE_LABELS[stage]}
            </span>
          </div>

          <h3 className="font-display text-2xl font-bold text-foreground mt-5">{pet.pet_name}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {speciesById(pet.species).name} · Day {ageDays}
          </p>

          {/* Growth */}
          <div className="w-full mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Growth</span>
              <span className="text-xs text-muted-foreground">
                {stage >= 3 ? "Fully grown" : `${STAGE_LABELS[stage]} → ${STAGE_LABELS[stage + 1]}`}
              </span>
            </div>
            <Progress value={growthPct} className="h-2.5" />
          </div>

          {/* Happiness — only once grown */}
          {grown ? (
            <div className="w-full mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-rose-400" /> Happiness
                </span>
                <span className="text-xs text-muted-foreground">{happiness}%</span>
              </div>
              <Progress value={happiness} className="h-2.5" />
              <Button
                onClick={handleFeed}
                disabled={!canFeed || feeding}
                className="mt-4 w-full h-11 rounded-xl"
              >
                {feeding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : canFeed ? (
                  <><Drumstick className="w-4 h-4 mr-1.5" /> Feed {pet.pet_name}</>
                ) : (
                  <><Check className="w-4 h-4 mr-1.5" /> Fed today — come back tomorrow</>
                )}
              </Button>
            </div>
          ) : (
            <div className="w-full mt-4 flex items-center gap-2 rounded-xl bg-muted/10 border border-border/20 px-4 py-3 text-xs text-muted-foreground">
              <Lock className="w-4 h-4 shrink-0" />
              Keep showing up — feeding & outfits unlock once {pet.pet_name} is grown (around day 10).
            </div>
          )}
        </Card>

        {/* Customisation + PFP */}
        <div className="space-y-4">
          <Card className="p-5 bg-card/60 border-border/30">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-primary" />
              <h3 className="font-display font-semibold text-foreground">Dress up</h3>
              {!grown && <Lock className="w-3.5 h-3.5 text-muted-foreground ml-auto" />}
            </div>

            {grown ? (
              <div className="space-y-4">
                {(Object.keys(ACCESSORIES) as AccessorySlot[]).map((slot) => (
                  <div key={slot}>
                    <p className="text-xs text-muted-foreground mb-2 capitalize">{slot}</p>
                    <div className="flex flex-wrap gap-2">
                      {ACCESSORIES[slot].map((opt) => {
                        const active = (accessories[slot] ?? "none") === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => setAccessory(slot, opt.id)}
                            className={cn(
                              "px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 transition-colors border",
                              active
                                ? "bg-primary/15 border-primary/40 text-foreground"
                                : "bg-muted/10 border-border/20 text-muted-foreground hover:bg-muted/20"
                            )}
                          >
                            {opt.id === "none" ? (
                              <Ban className="w-4 h-4 opacity-50" />
                            ) : (
                              <span
                                className="w-5 h-5 shrink-0"
                                dangerouslySetInnerHTML={{ __html: accessoryPreviewSvgString(slot, opt.id) }}
                              />
                            )}
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Outfits unlock once {pet.pet_name} grows up.
              </p>
            )}
          </Card>

          <Card className="p-5 bg-card/60 border-border/30">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-muted/20 border border-border/30 shrink-0 flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <PetAvatar species={pet.species ?? "chick"} stage={stage} accessories={accessories} size={48} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-foreground text-sm">Use as profile picture</h3>
                <p className="text-xs text-muted-foreground">Snapshot your pet, accessories and all.</p>
              </div>
              <Button onClick={handleSetPfp} disabled={savingPfp} variant="secondary" className="rounded-xl shrink-0">
                {savingPfp ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageUp className="w-4 h-4" />}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
