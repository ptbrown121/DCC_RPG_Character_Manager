"use client";

import { useState } from "react";
import {
  LOOT_TIERS,
  LOOT_BOX_TYPES,
  PET_ATTITUDES,
  PET_ROLES,
  PET_PRICE_GOLD,
  MOUNT_PRICE_GOLD,
  MOUNT_UPGRADE_GOLD,
  PET_MATURE_LEVEL,
  PET_STAT_POINTS_PER_LEVEL,
  petLevelStep,
  mountHbSlots,
  tamingDifficulty,
  MINION_NOTE,
  type PetAttitude,
  type PetRole,
} from "@/lib/rules";
import type { Character, CompanionEntry, LootBoxEntry } from "@/lib/types";

const TIER_COLORS: Record<string, string> = {
  Bronze: "text-orange-400",
  Silver: "text-zinc-300",
  Gold: "text-amber-400",
  Platinum: "text-cyan-300",
  Legendary: "text-purple-400",
  Celestial: "text-pink-300",
};

export function LootPanel({
  character,
  onPatch,
}: {
  character: Character;
  onPatch: (patch: Partial<Character>) => void;
}) {
  const loot = character.loot ?? [];
  const [tier, setTier] = useState<string>("Bronze");
  const [type, setType] = useState<string>("Adventurer");
  const [source, setSource] = useState("");

  function addBox() {
    const entry: LootBoxEntry = {
      tier,
      type,
      source: source.trim(),
      opened: false,
      contents: "",
      at: new Date().toISOString().slice(0, 10),
    };
    onPatch({ loot: [...loot, entry] });
    setSource("");
  }

  function patchBox(i: number, patch: Partial<LootBoxEntry>) {
    onPatch({ loot: loot.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  }

  const unopened = loot.filter((b) => !b.opened).length;

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-2 font-semibold">
        Loot Boxes {unopened > 0 && <span className="text-sm font-normal text-amber-400">({unopened} unopened 🎁)</span>}
      </h2>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <select value={tier} onChange={(e) => setTier(e.target.value)} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1">
          {LOOT_TIERS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1">
          {LOOT_BOX_TYPES.map((t) => (
            <option key={t} value={t}>{t} Box</option>
          ))}
        </select>
        <input placeholder="Source (boss, achievement…)" value={source} onChange={(e) => setSource(e.target.value)} className="w-52 rounded border border-zinc-700 bg-zinc-800 px-2 py-1" />
        <button onClick={addBox} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">+ Award</button>
      </div>
      <ul className="space-y-1 text-sm">
        {loot.map((b, i) => (
          <li key={i} className={`rounded border px-3 py-1.5 ${b.opened ? "border-zinc-800 bg-zinc-950 opacity-70" : "border-amber-900 bg-zinc-950"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span>
                {b.opened ? "📭" : "🎁"} <b className={TIER_COLORS[b.tier] ?? ""}>{b.tier}</b> {b.type} Box
                {b.source && <span className="text-xs text-zinc-500"> — {b.source}</span>}
                <span className="ml-1 text-xs text-zinc-600">{b.at}</span>
              </span>
              <span className="ml-auto flex items-center gap-2">
                {!b.opened && (
                  <button onClick={() => patchBox(i, { opened: true })} className="rounded bg-amber-500 px-2 py-0.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400">
                    Open
                  </button>
                )}
                <button onClick={() => onPatch({ loot: loot.filter((_, j) => j !== i) })} className="text-zinc-600 hover:text-red-400">✕</button>
              </span>
            </div>
            {b.opened && (
              <input
                placeholder="Contents…"
                value={b.contents}
                onChange={(e) => patchBox(i, { contents: e.target.value })}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
              />
            )}
          </li>
        ))}
        {loot.length === 0 && <li className="text-xs text-zinc-500">No boxes yet. Do something noteworthy (or stupid).</li>}
      </ul>
    </section>
  );
}

export function CompanionsPanel({
  character,
  onPatch,
}: {
  character: Character;
  onPatch: (patch: Partial<Character>) => void;
}) {
  const companions = character.companions ?? [];

  function add(kind: CompanionEntry["kind"]) {
    const entry: CompanionEntry = {
      kind,
      name: "",
      species: "",
      level: 1,
      attitude: kind === "pet" ? "hostile" : undefined,
      role: undefined,
      hb_slots: kind === "mount" ? mountHbSlots(5) : 10,
      current_slots: kind === "mount" ? mountHbSlots(5) : 10,
      notes: "",
    };
    onPatch({ companions: [...companions, entry] });
  }

  function patch(i: number, p: Partial<CompanionEntry>) {
    onPatch({ companions: companions.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  }

  const bondedPets = companions.filter((c) => c.kind === "pet" && c.attitude === "bonded").length;

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Companions</h2>
        <span className="text-xs text-zinc-500">
          Pet {PET_PRICE_GOLD.toLocaleString()}g or tame · Mount {MOUNT_PRICE_GOLD.toLocaleString()}g
          (upgrades {MOUNT_UPGRADE_GOLD.toLocaleString()}g) · taming vs {tamingDifficulty(0, character.floor)}+INT Mod
        </span>
        <div className="ml-auto flex gap-1 text-xs">
          <button onClick={() => add("pet")} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">+ Pet</button>
          <button onClick={() => add("mount")} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">+ Mount</button>
          <button onClick={() => add("minion")} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">+ Minion</button>
        </div>
      </div>
      {bondedPets > 1 && (
        <p className="mb-2 text-xs text-red-400">⚠ {bondedPets} Bonded pets — usually only one at a time (Animal Handling upgrades/class can change this).</p>
      )}
      <div className="space-y-2">
        {companions.map((c, i) => (
          <div key={i} className="rounded border border-zinc-800 bg-zinc-950 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase text-zinc-400">{c.kind}</span>
              <input placeholder="Name" value={c.name} onChange={(e) => patch(i, { name: e.target.value })} className="w-32 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-semibold" />
              <input placeholder="Species" value={c.species} onChange={(e) => patch(i, { species: e.target.value })} className="w-32 rounded border border-zinc-700 bg-zinc-800 px-2 py-1" />

              {c.kind === "pet" && (
                <>
                  <span className="text-xs text-zinc-400">
                    Lv <b className={c.level >= PET_MATURE_LEVEL ? "text-amber-400" : "text-zinc-200"}>{c.level}</b>
                    {c.level >= PET_MATURE_LEVEL && " (mature)"}
                  </span>
                  <button
                    onClick={() => patch(i, { level: c.level + petLevelStep(c.level) })}
                    className="rounded bg-zinc-800 px-2 py-0.5 text-xs hover:bg-zinc-700"
                    title={`Pets level with the party: +${petLevelStep(c.level)} at a time (${PET_STAT_POINTS_PER_LEVEL} stat pts/level, never INT). Ranks always = Floor.`}
                  >
                    +{petLevelStep(c.level)} Lv
                  </button>
                  <select value={c.attitude} onChange={(e) => patch(i, { attitude: e.target.value as PetAttitude })} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs" title={PET_ATTITUDES.find((a) => a.value === c.attitude)?.climb}>
                    {PET_ATTITUDES.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                  {c.attitude === "bonded" && (
                    <select value={c.role ?? ""} onChange={(e) => patch(i, { role: (e.target.value || undefined) as PetRole })} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs">
                      <option value="">role…</option>
                      {PET_ROLES.map((r) => (
                        <option key={r.value} value={r.value} title={r.perk}>{r.label} — {r.perk}</option>
                      ))}
                    </select>
                  )}
                </>
              )}

              {c.kind === "mount" && (
                <label className="text-xs text-zinc-400">
                  Size{" "}
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={c.hb_slots}
                    onChange={(e) => {
                      const slots = mountHbSlots(Number(e.target.value));
                      patch(i, { hb_slots: slots, current_slots: Math.min(c.current_slots, slots) });
                    }}
                    className="w-12 rounded border border-zinc-700 bg-zinc-800 px-1 py-1 text-center"
                  />{" "}
                  (HB slots = size; rider must be smaller; no leveling)
                </label>
              )}

              {c.kind === "minion" && <span className="text-xs text-zinc-500">{MINION_NOTE}</span>}

              <span className="ml-auto flex items-center gap-1 text-xs text-zinc-400">
                HB
                <button onClick={() => patch(i, { current_slots: Math.max(0, c.current_slots - 1) })} className="rounded bg-zinc-800 px-1.5">−</button>
                <b className={c.current_slots === 0 ? "text-red-400" : ""}>{c.current_slots}/{c.hb_slots}</b>
                <button onClick={() => patch(i, { current_slots: Math.min(c.hb_slots, c.current_slots + 1) })} className="rounded bg-zinc-800 px-1.5">+</button>
                <button onClick={() => onPatch({ companions: companions.filter((_, j) => j !== i) })} className="ml-1 text-zinc-600 hover:text-red-400">✕</button>
              </span>
            </div>
            {c.kind === "pet" && (
              <p className="mt-1 text-[10px] text-zinc-600">
                Guided combat: INT-Opposed Animal Handling as an Action → pet fights the whole combat (2 Actions: Evade/Move/Attack only, 1 attack/round; Amazing Success = you direct it). Attack/spell ranks always = Floor ({character.floor}).
              </p>
            )}
            <input
              placeholder="Stats / special abilities / upgrades…"
              value={c.notes}
              onChange={(e) => patch(i, { notes: e.target.value })}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
            />
          </div>
        ))}
        {companions.length === 0 && <p className="text-xs text-zinc-500">No companions. Every crawler needs a Mongo.</p>}
      </div>
    </section>
  );
}
