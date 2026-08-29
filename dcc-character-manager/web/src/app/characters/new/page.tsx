"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate, { useUser } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";
import {
  STAT_KEYS,
  STAT_LABELS,
  STANDARD_ARRAY,
  type StatKey,
  type StatScores,
  emptyScores,
  statMod,
  deriveFromEnhanced,
  ENTRY_POINTS,
  creationStatPoints,
} from "@/lib/rules";
import type { SkillRow } from "@/lib/types";

const SKILL_STATS: (StatKey | "")[] = ["", ...STAT_KEYS];

function NewCharacter() {
  const { user } = useUser();
  const router = useRouter();
  const [name, setName] = useState("");
  const [entry, setEntry] = useState(0); // index into ENTRY_POINTS
  const [race, setRace] = useState("");
  const [klass, setKlass] = useState("");
  const [scores, setScores] = useState<StatScores>(emptyScores(0));
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entryPoint = ENTRY_POINTS[entry];
  const derived = useMemo(() => deriveFromEnhanced(scores), [scores]);
  const bonusPoints = creationStatPoints(entryPoint.level);

  function setScore(key: StatKey, value: number) {
    setScores((s) => ({ ...s, [key]: Math.max(0, value) }));
  }

  /** Quick-assign the Standard Array 2-3-4-5-6 in STR/INT/CON/DEX/CHA order (edit after). */
  function applyStandardArray() {
    const next = { ...emptyScores(0) };
    STAT_KEYS.forEach((k, i) => (next[k] = STANDARD_ARRAY[i]));
    setScores(next);
  }

  /** Random option: 1d6 per stat in order, reroll 1s. */
  function rollStats() {
    const roll = () => {
      let r = 1;
      while (r === 1) r = 1 + Math.floor(Math.random() * 6);
      return r;
    };
    setScores({ str: roll(), int: roll(), con: roll(), dex: roll(), cha: roll() });
  }

  function addSkill() {
    setSkills((s) => [
      ...s,
      { name: "", category: "utility", stat: "int", check_type: "unopposed", rank: 1, marked: false },
    ]);
  }

  function updateSkill(i: number, patch: Partial<SkillRow>) {
    setSkills((s) => s.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  async function save() {
    if (!user || !name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    // Everyone gets the Heal spell on entry (2 Mana, restores 2 HB slots, self only).
    const spells = [{ name: "Heal", mana: 2, range: "Self", effect: "Heal 2 HB slots (Interrupt)", rank: 1 }];
    const { data, error } = await supabase()
      .from("characters")
      .insert({
        owner_id: user.id,
        name: name.trim(),
        level: entryPoint.level,
        floor: entryPoint.floor,
        race: race.trim() || null,
        class: klass.trim() || null,
        stats: { enhanced: scores, unenhanced: scores },
        current_hb_slots: 10,
        current_mana: derived.maxMana,
        ai_favor: 1,
        skills: skills.filter((s) => s.name.trim()),
        spells,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/characters/${data.id}`);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-bold">New Crawler</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-zinc-400">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">Entry point</span>
          <select
            value={entry}
            onChange={(e) => setEntry(Number(e.target.value))}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2"
          >
            {ENTRY_POINTS.map((ep, i) => (
              <option key={ep.level} value={i}>
                {ep.label}
              </option>
            ))}
          </select>
        </label>
        {entryPoint.level > 1 && (
          <>
            <label className="block text-sm">
              <span className="text-zinc-400">Race (chosen on Floor 3)</span>
              <input
                value={race}
                onChange={(e) => setRace(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-400">Class (chosen on Floor 3)</span>
              <input
                value={klass}
                onChange={(e) => setKlass(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2"
              />
            </label>
          </>
        )}
      </div>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="font-semibold">Stats</h2>
          <button onClick={applyStandardArray} className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">
            Standard Array (2-3-4-5-6)
          </button>
          <button onClick={rollStats} className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">
            Roll 1d6 ×5 (reroll 1s)
          </button>
          {bonusPoints > 0 && (
            <span className="text-xs text-amber-400">
              +{bonusPoints} stat points for Level {entryPoint.level} entry ((Level−1)×3)
            </span>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {STAT_KEYS.map((k) => (
            <label key={k} className="block text-center text-sm">
              <span className="text-xs uppercase text-zinc-400">{STAT_LABELS[k]}</span>
              <input
                type="number"
                min={0}
                value={scores[k]}
                onChange={(e) => setScore(k, Number(e.target.value))}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-2 text-center"
              />
              <span className="mt-1 block font-mono text-xs text-emerald-400">
                {scores[k] >= 1 ? `+${statMod(scores[k])}` : "—"}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-300 sm:grid-cols-4">
          <div>Health: <b>{derived.maxHealth}</b> (10 × {derived.hbSlotValue})</div>
          <div>Mana: <b>{derived.maxMana}</b> (= INT score)</div>
          <div>Evade: <b>d20 +{derived.evadeBonus}</b> (DEX Mod)</div>
          <div>Lift: <b>{derived.liftLimitLbs} lbs</b> (STR × 15)</div>
          <div>Move: <b>{derived.moveFt} ft</b> + 10 ft Step</div>
          <div>Breath: <b>{derived.breathRounds}</b> rounds</div>
          <div>Dying countdown: <b>{derived.dyingCountdown}</b></div>
          <div>AI Favor: <b>1</b> (human start)</div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Skills</h2>
          <button onClick={addSkill} className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">
            + Add skill
          </button>
        </div>
        <p className="mb-3 text-xs text-zinc-500">
          Level 1 creation: 2-of-3 skills from each of four backgrounds (Ranks 1/1/3/2) plus a base
          strike and your weapon at Rank 3 — 10 skills total. Everyone also knows Heal (added
          automatically).
        </p>
        {skills.map((s, i) => (
          <div key={i} className="mb-2 grid grid-cols-[1fr_7rem_5rem_7rem_4rem_2rem] items-center gap-2 text-sm">
            <input
              placeholder="Skill name"
              value={s.name}
              onChange={(e) => updateSkill(i, { name: e.target.value })}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
            />
            <select
              value={s.category}
              onChange={(e) => updateSkill(i, { category: e.target.value as SkillRow["category"] })}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
            >
              <option value="attack">Attack</option>
              <option value="spell">Spell</option>
              <option value="utility">Utility</option>
            </select>
            <select
              value={s.stat ?? ""}
              onChange={(e) => updateSkill(i, { stat: (e.target.value || null) as SkillRow["stat"] })}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
            >
              {SKILL_STATS.map((k) => (
                <option key={k} value={k}>
                  {k ? k.toUpperCase() : "—"}
                </option>
              ))}
            </select>
            <select
              value={s.check_type}
              onChange={(e) => updateSkill(i, { check_type: e.target.value as SkillRow["check_type"] })}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
            >
              <option value="unopposed">Unopposed</option>
              <option value="opposed">Opposed</option>
              <option value="passive">Passive</option>
              <option value="evade">vs. Evade</option>
            </select>
            <input
              type="number"
              min={0}
              max={20}
              value={s.rank}
              onChange={(e) => updateSkill(i, { rank: Number(e.target.value) })}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-center"
            />
            <button
              onClick={() => setSkills((rows) => rows.filter((_, j) => j !== i))}
              className="text-zinc-500 hover:text-red-400"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="rounded bg-amber-500 px-4 py-2 font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Create Crawler"}
      </button>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <NewCharacter />
    </AuthGate>
  );
}
