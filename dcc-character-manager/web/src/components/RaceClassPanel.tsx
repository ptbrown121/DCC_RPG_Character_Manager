"use client";

import { useMemo, useState } from "react";
import {
  STAT_KEYS,
  catalogSkill,
  ALL_RACES,
  ALL_CLASSES,
  RACE_BUILD_POINTS,
  CLASS_BUILD_POINTS,
  MAX_DETRIMENT_BP,
  BENEFIT_COST,
  BUILD_BENEFITS,
  BUILD_DETRIMENTS,
  detrimentBpForPenaltyPoints,
  type BenefitTier,
  type CatalogRace,
  type CatalogClass,
  type SkillGrant,
} from "@/lib/rules";
import type { Character, SkillRow, Traits } from "@/lib/types";

type Slot = "race" | "class";

interface ApplyPayload {
  slot: Slot;
  name: string;
  statBonuses: Partial<Record<(typeof STAT_KEYS)[number], number>>;
  skillGrants: SkillGrant[];
  abilities: string[];
  drawbacks: string[];
  custom?: boolean;
}

const TIERS: BenefitTier[] = ["minor", "moderate", "major", "extreme", "epic"];

function Block({ title, entry }: { title: string; entry: CatalogRace | CatalogClass }) {
  const bonuses = Object.entries(entry.statBonuses)
    .map(([k, v]) => `+${v} ${k.toUpperCase()}`)
    .join(", ");
  return (
    <div className="mt-2 rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
      <div className="mb-1 font-semibold text-zinc-100">{title}</div>
      {"classTypes" in entry && entry.classTypes.length > 0 && (
        <div className="text-zinc-500">Class type: {entry.classTypes.join(", ")}</div>
      )}
      {bonuses && <div>Stats: {bonuses}</div>}
      {entry.skillGrants.length > 0 && (
        <div>
          Skills:{" "}
          {entry.skillGrants
            .map((g) => `${g.ranks > 0 ? `+${g.ranks} ` : ""}${g.name}${g.toRank20 ? " (→R20)" : ""}`)
            .join(", ")}
        </div>
      )}
      {entry.abilities.length > 0 && (
        <ul className="mt-1 list-disc pl-4">
          {entry.abilities.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
      {entry.drawbacks.length > 0 && (
        <ul className="mt-1 list-disc pl-4 text-red-300">
          {entry.drawbacks.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      {entry.prerequisites && <div className="mt-1 text-amber-300">Requires: {entry.prerequisites}</div>}
      {entry.note && <div className="mt-1 text-zinc-500">⚠ {entry.note}</div>}
    </div>
  );
}

function PointBuyBuilder({ slot, onApply }: { slot: Slot; onApply: (p: ApplyPayload) => void }) {
  const [name, setName] = useState("");
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [detriments, setDetriments] = useState<Record<string, number>>({});
  const [penaltyPoints, setPenaltyPoints] = useState(0);

  const budget = slot === "race" ? RACE_BUILD_POINTS : CLASS_BUILD_POINTS;
  const spent = useMemo(
    () =>
      Object.entries(picks).reduce((sum, [label, qty]) => {
        const b = BUILD_BENEFITS.find((x) => x.label === label);
        return sum + (b ? BENEFIT_COST[b.tier] * qty : 0);
      }, 0),
    [picks],
  );
  const refundRaw = useMemo(
    () =>
      Object.entries(detriments).reduce((sum, [label, qty]) => {
        const d = BUILD_DETRIMENTS.find((x) => x.label === label);
        return sum + (d ? d.bp * qty : 0);
      }, 0) + detrimentBpForPenaltyPoints(penaltyPoints),
    [detriments, penaltyPoints],
  );
  const refund = Math.min(MAX_DETRIMENT_BP, refundRaw);
  const total = budget + refund;
  const remaining = total - spent;

  function bump(map: Record<string, number>, set: (m: Record<string, number>) => void, label: string, delta: number) {
    const next = { ...map, [label]: Math.max(0, (map[label] ?? 0) + delta) };
    if (next[label] === 0) delete next[label];
    set(next);
  }

  function apply() {
    if (!name.trim() || remaining < 0) return;
    const abilities = Object.entries(picks).map(
      ([label, qty]) => `${qty > 1 ? `${qty}× ` : ""}${label}`,
    );
    const drawbacks = [
      ...Object.entries(detriments).map(([label, qty]) => `${qty > 1 ? `${qty}× ` : ""}${label}`),
      ...(penaltyPoints > 0 ? [`−${penaltyPoints} points of stat/skill penalties`] : []),
    ];
    onApply({ slot, name: name.trim(), statBonuses: {}, skillGrants: [], abilities, drawbacks, custom: true });
  }

  return (
    <div className="mt-3 space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <input
          placeholder={`Custom ${slot} name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
        />
        <span className={`font-mono text-xs ${remaining < 0 ? "text-red-400" : "text-emerald-400"}`}>
          {spent}/{total} BP spent ({budget} base + {refund} from detriments, cap +{MAX_DETRIMENT_BP})
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
          <div className="mb-1 text-xs font-semibold uppercase text-zinc-500">Benefits</div>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {TIERS.map((tier) => (
              <div key={tier}>
                <div className="text-[10px] uppercase tracking-wide text-amber-400">
                  {tier} — {BENEFIT_COST[tier]} BP
                </div>
                {BUILD_BENEFITS.filter((b) => b.tier === tier).map((b) => {
                  const qty = picks[b.label] ?? 0;
                  return (
                    <div key={b.label} className="flex items-center justify-between gap-2 py-0.5 text-xs">
                      <span className={qty ? "text-zinc-100" : "text-zinc-400"}>{b.label}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {qty > 0 && (
                          <button onClick={() => bump(picks, setPicks, b.label, -1)} className="rounded bg-zinc-800 px-1.5">−</button>
                        )}
                        {qty > 0 && <span className="w-4 text-center">{qty}</span>}
                        <button
                          onClick={() => bump(picks, setPicks, b.label, 1)}
                          disabled={qty > 0 && !b.stacks}
                          className="rounded bg-zinc-800 px-1.5 disabled:opacity-30"
                        >
                          +
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
          <div className="mb-1 text-xs font-semibold uppercase text-zinc-500">
            Detriments (max +{MAX_DETRIMENT_BP} BP)
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-zinc-400">Stat/skill penalty points (1 BP per 2)</span>
              <input
                type="number"
                min={0}
                value={penaltyPoints}
                onChange={(e) => setPenaltyPoints(Math.max(0, Number(e.target.value)))}
                className="w-14 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-center"
              />
            </div>
            {BUILD_DETRIMENTS.map((d) => {
              const qty = detriments[d.label] ?? 0;
              return (
                <div key={d.label} className="flex items-center justify-between gap-2 py-0.5 text-xs">
                  <span className={qty ? "text-zinc-100" : "text-zinc-400"}>
                    {d.label} <span className="text-zinc-600">(+{d.bp})</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {qty > 0 && (
                      <button onClick={() => bump(detriments, setDetriments, d.label, -1)} className="rounded bg-zinc-800 px-1.5">−</button>
                    )}
                    {qty > 0 && <span className="w-4 text-center">{qty}</span>}
                    <button onClick={() => bump(detriments, setDetriments, d.label, 1)} className="rounded bg-zinc-800 px-1.5">+</button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Custom builds record your picks as ability text. Apply any &quot;+1 to a Stat&quot; or skill-rank
        picks manually to the stats/skills above (the GM prices original benefits — leftover BP are lost).
      </p>
      <button
        onClick={apply}
        disabled={!name.trim() || remaining < 0}
        className="rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
      >
        Apply custom {slot}
      </button>
    </div>
  );
}

export default function RaceClassPanel({
  character,
  onApply,
}: {
  character: Character;
  onApply: (patch: Partial<Character>) => void;
}) {
  const [slot, setSlot] = useState<Slot>("race");
  const [mode, setMode] = useState<"pick" | "build">("pick");
  const [selected, setSelected] = useState("");

  const options = slot === "race" ? ALL_RACES : ALL_CLASSES;
  const entry = options.find((o) => o.name === selected);
  const applied = character.traits?.[slot];

  function applyEntry(p: ApplyPayload) {
    const stats = structuredClone(character.stats);
    for (const k of STAT_KEYS) {
      const bonus = p.statBonuses[k] ?? 0;
      if (bonus) {
        stats.enhanced[k] += bonus;
        stats.unenhanced[k] += bonus;
      }
    }
    let skills: SkillRow[] = [...character.skills];
    for (const g of p.skillGrants) {
      const existing = skills.findIndex((s) => s.name === g.name);
      if (existing >= 0) {
        skills = skills.map((s, i) => (i === existing ? { ...s, rank: s.rank + g.ranks } : s));
      } else {
        const cat = catalogSkill(g.name);
        skills.push({
          name: g.name,
          category: g.note === "spell" ? "spell" : (cat?.category ?? "utility"),
          stat: cat?.stat ?? null,
          check_type: cat?.checkType ?? "unopposed",
          rank: g.ranks,
          marked: false,
          notes: g.toRank20 ? "Can be raised to Rank 20" : g.note,
        });
      }
    }
    const traits: Traits = {
      ...character.traits,
      [p.slot]: { name: p.name, abilities: p.abilities, drawbacks: p.drawbacks, custom: p.custom },
    };
    onApply({
      stats,
      skills,
      traits,
      ...(p.slot === "race" ? { race: p.name } : { class: p.name }),
    });
    setSelected("");
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Race &amp; Class</h2>
        <span className="text-xs text-zinc-500">(unlocks on Floor 3 — 3 options each, or point-buy)</span>
        <div className="ml-auto flex gap-1 text-xs">
          {(["race", "class"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setSlot(s);
                setSelected("");
              }}
              className={`rounded px-2 py-1 ${slot === s ? "bg-amber-500 font-semibold text-zinc-950" : "bg-zinc-800"}`}
            >
              {s === "race" ? "Race" : "Class"}
            </button>
          ))}
          {(["pick", "build"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-2 py-1 ${mode === m ? "bg-zinc-600 font-semibold" : "bg-zinc-800"}`}
            >
              {m === "pick" ? "Book picklist" : "Point-buy"}
            </button>
          ))}
        </div>
      </div>

      {applied && (
        <div className="mb-2 rounded border border-emerald-900 bg-emerald-950/40 p-3 text-xs">
          <div className="font-semibold text-emerald-300">
            Applied {slot}: {applied.name}
            {applied.custom ? " (custom build)" : ""}
          </div>
          {applied.abilities.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-zinc-300">
              {applied.abilities.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
          {applied.drawbacks.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-red-300">
              {applied.drawbacks.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-zinc-500">
            Re-applying another {slot} adds its bonuses on top — adjust stats/skills manually if swapping.
          </p>
        </div>
      )}

      {mode === "pick" ? (
        <div>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm sm:w-96"
          >
            <option value="">Choose a {slot}… ({options.length} in catalog)</option>
            {options.map((o) => (
              <option key={o.name} value={o.name}>
                {o.name}
                {"kind" in o ? ` (${o.kind})` : ""}
              </option>
            ))}
          </select>
          {entry && (
            <>
              <Block title={entry.name} entry={entry} />
              <button
                onClick={() =>
                  applyEntry({
                    slot,
                    name: entry.name,
                    statBonuses: entry.statBonuses,
                    skillGrants: entry.skillGrants,
                    abilities: entry.abilities,
                    drawbacks: entry.drawbacks,
                  })
                }
                className="mt-2 rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
              >
                Apply {entry.name} (adds stats &amp; skill ranks)
              </button>
            </>
          )}
        </div>
      ) : (
        <PointBuyBuilder slot={slot} onApply={applyEntry} />
      )}
    </section>
  );
}
