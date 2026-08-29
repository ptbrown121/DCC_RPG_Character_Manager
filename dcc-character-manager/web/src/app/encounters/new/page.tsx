"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate, { useUser } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";
import {
  STAT_KEYS,
  type StatScores,
  emptyScores,
  statMod,
  ENCOUNTER_STRENGTHS,
  STRENGTH_LABELS,
  type EncounterStrength,
  suggestedMobCount,
  typicalMobLevels,
  typicalBossLevels,
  trapDamageDice,
  BOSS_TIERS,
  BOSS_TIER_LABELS,
  type BossTier,
  BOSS_SEVERITY,
  mobHbSlots,
  bossHbSlots,
  statBudget,
  budgetSpent,
  mobSurprise,
  mobEvade,
  mobDr,
  mobMove,
  damageDiceForLevel,
  CREATURE_SIZES,
} from "@/lib/rules";
import type { Character } from "@/lib/types";

interface DraftMob {
  name: string;
  kind: "mob" | "boss";
  level: number;
  size: number;
  bossTier: BossTier | null;
  isElite: boolean;
  stats: StatScores;
  drAdjust: number;
  count: number;
  abilities: string;
}

function newDraft(level: number): DraftMob {
  return {
    name: "",
    kind: "mob",
    level,
    size: 4,
    bossTier: null,
    isElite: false,
    stats: emptyScores(1),
    drAdjust: 0,
    count: 1,
    abilities: "",
  };
}

function NewEncounter() {
  const { user } = useUser();
  const router = useRouter();
  const [name, setName] = useState("");
  const [floor, setFloor] = useState(3);
  const [partySize, setPartySize] = useState(4);
  const [strength, setStrength] = useState<EncounterStrength>("moderate");
  const [mobs, setMobs] = useState<DraftMob[]>([]);
  const [draft, setDraft] = useState<DraftMob>(newDraft(10));
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCrawlers, setSelectedCrawlers] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase()
      .from("characters")
      .select("*")
      .then(({ data }) => setCharacters((data as Character[]) ?? []));
  }, []);

  const mobRange = typicalMobLevels(floor);
  const bossRange = typicalBossLevels(floor);
  const suggested = suggestedMobCount(partySize, strength);
  const plannedCount = mobs.filter((m) => m.kind === "mob").reduce((n, m) => n + m.count, 0);

  const budget = useMemo(
    () => statBudget(draft.level, draft.kind === "boss" ? (draft.bossTier ?? "neighborhood") : undefined),
    [draft.level, draft.kind, draft.bossTier],
  );
  const spent = budgetSpent(draft.stats);
  const hbSlots =
    draft.kind === "boss" ? bossHbSlots(draft.bossTier ?? "neighborhood", floor) : mobHbSlots(draft.level);

  function addDraft() {
    if (!draft.name.trim()) return;
    setMobs((m) => [...m, { ...draft, name: draft.name.trim() }]);
    setDraft(newDraft(draft.level));
  }

  async function save() {
    if (!user) return;
    if (!name.trim()) {
      setError("Encounter name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const sb = supabase();
    const { data: enc, error: encErr } = await sb
      .from("encounters")
      .insert({ owner_id: user.id, name: name.trim(), floor, party_size: partySize, strength })
      .select("id")
      .single();
    if (encErr || !enc) {
      setSaving(false);
      setError(encErr?.message ?? "Failed to create encounter");
      return;
    }
    const rows: Record<string, unknown>[] = [];
    let sort = 0;
    for (const m of mobs) {
      const conMod = statMod(m.stats.con);
      const slots = m.kind === "boss" ? bossHbSlots(m.bossTier ?? "neighborhood", floor) : mobHbSlots(m.level);
      for (let i = 0; i < m.count; i++) {
        rows.push({
          encounter_id: enc.id,
          owner_id: user.id,
          kind: m.kind,
          name: m.count > 1 ? `${m.name} ${i + 1}` : m.name,
          level: m.level,
          size: m.size,
          boss_tier: m.kind === "boss" ? (m.bossTier ?? "neighborhood") : null,
          is_elite: m.isElite,
          stats: m.stats,
          hb_slots: slots,
          slot_value: Math.max(1, conMod),
          current_slots: slots,
          dr: mobDr(floor, m.drAdjust),
          move_ft: mobMove(m.size),
          attacks: [
            {
              name: "Attack",
              dice: damageDiceForLevel(m.level),
              die: 6,
              bonus: statMod(m.stats.str),
              damage_type: "Bludgeoning",
            },
          ],
          abilities: m.abilities || null,
          sort: sort++,
        });
      }
    }
    for (const cid of selectedCrawlers) {
      const ch = characters.find((x) => x.id === cid);
      if (!ch) continue;
      rows.push({
        encounter_id: enc.id,
        owner_id: user.id,
        kind: "crawler",
        name: ch.name,
        level: ch.level,
        size: 4,
        character_id: ch.id,
        stats: ch.stats.enhanced,
        hb_slots: 10,
        slot_value: Math.max(1, statMod(ch.stats.enhanced.con)),
        current_slots: ch.current_hb_slots,
        dr: 0,
        move_ft: ch.move_ft,
        attacks: [],
        sort: sort++,
      });
    }
    if (rows.length) {
      const { error: cErr } = await sb.from("encounter_combatants").insert(rows);
      if (cErr) {
        setSaving(false);
        setError(cErr.message);
        return;
      }
    }
    router.push(`/encounters/${enc.id}`);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-xl font-bold">New Encounter</h1>

      <section className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:grid-cols-4">
        <label className="block text-sm sm:col-span-2">
          <span className="text-zinc-400">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Floor</span>
          <input type="number" min={1} max={18} value={floor} onChange={(e) => setFloor(Number(e.target.value))} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Party size</span>
          <input type="number" min={2} max={7} value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2" />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="text-zinc-400">Group strength (Table 49)</span>
          <select value={strength} onChange={(e) => setStrength(e.target.value as EncounterStrength)} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2">
            {ENCOUNTER_STRENGTHS.map((s) => (
              <option key={s} value={s}>{STRENGTH_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2 rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
          <div>Suggested mob count: <b className="text-amber-400">{suggested}{strength === "overwhelming" ? "+" : ""}</b> (planned: {plannedCount})</div>
          {mobRange && <div>Typical mob levels for Floor {floor}: <b>{mobRange[0]}–{mobRange[1]}</b></div>}
          {bossRange && <div>Typical boss levels: <b>{bossRange[0]}–{bossRange[1]}</b> (next row down on Table 51)</div>}
          <div>Trap damage here: <b>{trapDamageDice(floor)}</b> · Mob DR baseline: <b>{floor}</b></div>
        </div>
      </section>

      {/* Mob builder */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-3 font-semibold">Add Mob / Boss</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block text-sm sm:col-span-2">
            <span className="text-zinc-400">Name</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5" />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Kind</span>
            <select
              value={draft.kind}
              onChange={(e) => {
                const kind = e.target.value as "mob" | "boss";
                setDraft({ ...draft, kind, bossTier: kind === "boss" ? (draft.bossTier ?? "neighborhood") : null, isElite: kind === "boss" ? true : draft.isElite });
              }}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5"
            >
              <option value="mob">Mob</option>
              <option value="boss">Boss</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Level</span>
            <input type="number" min={1} value={draft.level} onChange={(e) => setDraft({ ...draft, level: Math.max(1, Number(e.target.value)) })} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5" />
          </label>
          {draft.kind === "boss" && (
            <label className="block text-sm">
              <span className="text-zinc-400">Boss tier (Table 50)</span>
              <select value={draft.bossTier ?? "neighborhood"} onChange={(e) => setDraft({ ...draft, bossTier: e.target.value as BossTier })} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5">
                {BOSS_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {BOSS_TIER_LABELS[t]} ({BOSS_SEVERITY[t].statsPerLevel}/lvl, HB {BOSS_SEVERITY[t].hbBase}+F)
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm">
            <span className="text-zinc-400">Size</span>
            <select value={draft.size} onChange={(e) => setDraft({ ...draft, size: Number(e.target.value) })} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5">
              {CREATURE_SIZES.map((s) => (
                <option key={s.value} value={s.value}>{s.value} — {s.label}</option>
              ))}
            </select>
          </label>
          {draft.kind === "mob" && (
            <>
              <label className="mt-5 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.isElite} onChange={(e) => setDraft({ ...draft, isElite: e.target.checked })} />
                <span className="text-zinc-400">Elite (1 Action per crawler)</span>
              </label>
              <label className="block text-sm">
                <span className="text-zinc-400">Count</span>
                <input type="number" min={1} max={30} value={draft.count} onChange={(e) => setDraft({ ...draft, count: Math.max(1, Number(e.target.value)) })} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5" />
              </label>
            </>
          )}
          <label className="block text-sm">
            <span className="text-zinc-400">DR adjust (armor +1/+2, caster −1/−2)</span>
            <input type="number" min={-2} max={2} value={draft.drAdjust} onChange={(e) => setDraft({ ...draft, drAdjust: Number(e.target.value) })} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5" />
          </label>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-baseline gap-3 text-sm">
            <span className="text-zinc-400">Stat scores</span>
            <span className={`text-xs ${spent > budget.total ? "text-red-400" : "text-emerald-400"}`}>
              budget {spent}/{budget.total} ({budget.base} per stat + {budget.pool} pool)
            </span>
            <button
              type="button"
              onClick={() => {
                // Even spread of the budget across the five stats.
                const per = Math.floor(budget.total / 5);
                const rem = budget.total - per * 5;
                const next = emptyScores(per);
                STAT_KEYS.slice(0, rem).forEach((k) => (next[k] = per + 1));
                setDraft({ ...draft, stats: next });
              }}
              className="rounded bg-zinc-800 px-2 py-0.5 text-xs hover:bg-zinc-700"
            >
              Spread evenly
            </button>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {STAT_KEYS.map((k) => (
              <label key={k} className="block text-center text-sm">
                <span className="text-xs uppercase text-zinc-500">{k}</span>
                <input
                  type="number"
                  min={1}
                  value={draft.stats[k]}
                  onChange={(e) => setDraft({ ...draft, stats: { ...draft.stats, [k]: Math.max(1, Number(e.target.value)) } })}
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-center"
                />
                <span className="font-mono text-xs text-emerald-400">+{statMod(draft.stats[k])}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
          Derived: HB <b>{hbSlots} slots × {Math.max(1, statMod(draft.stats.con))}</b> · Evade{" "}
          <b>{mobEvade(draft.stats.dex)}+F = {mobEvade(draft.stats.dex) + floor}</b> · Surprise{" "}
          <b>{mobSurprise(draft.stats.int)}+F = {mobSurprise(draft.stats.int) + floor}</b> · DR{" "}
          <b>{mobDr(floor, draft.drAdjust)}</b> · Move <b>{mobMove(draft.size)} ft</b> · Damage{" "}
          <b>{damageDiceForLevel(draft.level)}d6 +{statMod(draft.stats.str)}</b> (Table 51; d4s for
          debuff riders, one fewer die for AoE/triggered)
        </div>

        <label className="mt-3 block text-sm">
          <span className="text-zinc-400">Abilities / notes</span>
          <input value={draft.abilities} onChange={(e) => setDraft({ ...draft, abilities: e.target.value })} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5" placeholder="Freeform ability notes (fail effects, riders, phases…)" />
        </label>

        <button onClick={addDraft} className="mt-3 rounded bg-zinc-700 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-600">
          Add to encounter
        </button>
      </section>

      {mobs.length > 0 && (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="mb-2 font-semibold">Roster</h2>
          <ul className="space-y-1 text-sm">
            {mobs.map((m, i) => (
              <li key={i} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                <span>
                  {m.count > 1 ? `${m.count}× ` : ""}
                  <b>{m.name}</b> — Lv {m.level} {m.kind === "boss" ? `${BOSS_TIER_LABELS[m.bossTier ?? "neighborhood"]} Boss` : m.isElite ? "Elite" : "Mob"}
                </span>
                <button onClick={() => setMobs((rows) => rows.filter((_, j) => j !== i))} className="text-zinc-600 hover:text-red-400">✕</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-2 font-semibold">Crawlers in this fight</h2>
        {characters.length === 0 && <p className="text-sm text-zinc-500">No saved crawlers.</p>}
        <div className="flex flex-wrap gap-2">
          {characters.map((ch) => {
            const on = selectedCrawlers.has(ch.id);
            return (
              <button
                key={ch.id}
                onClick={() => {
                  const next = new Set(selectedCrawlers);
                  if (on) next.delete(ch.id);
                  else next.add(ch.id);
                  setSelectedCrawlers(next);
                }}
                className={`rounded-full border px-3 py-1 text-sm ${on ? "border-amber-500 bg-amber-500/20 text-amber-300" : "border-zinc-700 bg-zinc-800 text-zinc-300"}`}
              >
                {ch.name} (Lv {ch.level})
              </button>
            );
          })}
        </div>
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button onClick={save} disabled={saving} className="rounded bg-amber-500 px-4 py-2 font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50">
        {saving ? "Saving…" : "Create Encounter"}
      </button>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <NewEncounter />
    </AuthGate>
  );
}
