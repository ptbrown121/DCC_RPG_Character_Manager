"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import HbTracker from "@/components/HbTracker";
import { supabase } from "@/lib/supabase";
import {
  STAT_KEYS,
  STAT_LABELS,
  statMod,
  deriveFromEnhanced,
  slotsLostToDamage,
  mitigateDamage,
  opposedDifficulty,
  unopposedDifficulty,
  statCheckDifficulty,
  REST_RULES,
  DEBUFFS,
  roundDown,
  type StatKey,
  type CatalogSkill,
  type CatalogSpell,
} from "@/lib/rules";
import { SkillSelect, SpellSelect } from "@/components/CatalogSelect";
import RaceClassPanel from "@/components/RaceClassPanel";
import type { Character, SkillRow, SpellRow } from "@/lib/types";

function Sheet() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Character | null>(null);
  const [damageIn, setDamageIn] = useState("");
  const [drIn, setDrIn] = useState("0");
  const [debuffPick, setDebuffPick] = useState(DEBUFFS[0].name);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    supabase()
      .from("characters")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => setC(data as Character));
  }, [id]);

  const derived = useMemo(() => (c ? deriveFromEnhanced(c.stats.enhanced, c.move_ft) : null), [c]);

  const persist = useCallback(async (patch: Partial<Character>) => {
    setC((prev) => (prev ? ({ ...prev, ...patch } as Character) : prev));
    setSaveState("saving");
    const { error } = await supabase()
      .from("characters")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaveState(error ? "error" : "saved");
  }, [id]);

  if (!c || !derived) return <p className="text-zinc-400">Loading…</p>;

  const { mods, hbSlotValue, maxMana } = derived;

  function applyDamage() {
    if (!c) return;
    const raw = Number(damageIn);
    if (!raw || raw <= 0) return;
    const afterDr = mitigateDamage(raw, { dr: Number(drIn) || 0 });
    const lost = slotsLostToDamage(afterDr, hbSlotValue);
    persist({ current_hb_slots: Math.max(0, c.current_hb_slots - lost) });
    setDamageIn("");
  }

  function updateSkill(i: number, patch: Partial<SkillRow>) {
    if (!c) return;
    persist({ skills: c.skills.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  }

  function shortRest() {
    if (!c) return;
    persist({
      current_hb_slots: Math.min(10, c.current_hb_slots + REST_RULES.shortRestSlots),
      current_mana: Math.min(maxMana, c.current_mana + roundDown(maxMana / 2)),
    });
  }

  function longRest() {
    if (!c) return;
    persist({
      current_hb_slots: 10,
      current_mana: maxMana,
      debuffs: c.debuffs.filter((d) => d.name !== "Fatigued"),
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{c.name}</h1>
          <p className="text-sm text-zinc-400">
            Level {c.level} · Floor {c.floor} ·{" "}
            {[c.race, c.class].filter(Boolean).join(" ") || "no race/class yet (Floor 3 unlock)"}
          </p>
        </div>
        <span className="text-xs text-zinc-500">
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "⚠ Save failed" : saveState === "saved" ? "Saved" : ""}
        </span>
      </header>

      {/* Stats */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-3 font-semibold">Stats (Enhanced layer)</h2>
        <div className="grid grid-cols-5 gap-2">
          {STAT_KEYS.map((k) => (
            <div key={k} className="rounded border border-zinc-800 bg-zinc-950 p-2 text-center">
              <div className="text-xs uppercase text-zinc-500">{STAT_LABELS[k]}</div>
              <input
                type="number"
                min={0}
                value={c.stats.enhanced[k]}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value));
                  persist({ stats: { ...c.stats, enhanced: { ...c.stats.enhanced, [k]: v } } });
                }}
                className="mt-1 w-full bg-transparent text-center text-lg font-bold outline-none"
              />
              <div className="font-mono text-xs text-emerald-400">+{statMod(c.stats.enhanced[k])}</div>
              <div className="mt-1 text-[10px] text-zinc-600">
                unenh.{" "}
                <input
                  type="number"
                  min={0}
                  value={c.stats.unenhanced[k]}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value));
                    persist({ stats: { ...c.stats, unenhanced: { ...c.stats.unenhanced, [k]: v } } });
                  }}
                  className="w-10 bg-transparent text-center text-[10px] text-zinc-400 outline-none"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 text-xs text-zinc-300 sm:grid-cols-4">
          <div>Evade: <b>d20 +{mods.dex}</b></div>
          <div>Lift: <b>{derived.liftLimitLbs} lbs</b></div>
          <div>Move: <b>{c.move_ft} ft</b> + 10 ft Step</div>
          <div>Dying countdown: <b>{mods.con}</b> rounds</div>
          <div>Opposed diff. vs you: <b>{opposedDifficulty(0, c.floor)}+Stat</b></div>
          <div>Unopposed (F{c.floor}): <b>{unopposedDifficulty(c.floor)}</b></div>
          <div>Stat Check (F{c.floor}): <b>{statCheckDifficulty(c.floor)}</b></div>
          <div>AI Favor:{" "}
            <button className="rounded bg-zinc-800 px-1" onClick={() => persist({ ai_favor: Math.max(0, c.ai_favor - 1) })}>−</button>{" "}
            <b>{c.ai_favor}</b>{" "}
            <button className="rounded bg-zinc-800 px-1" onClick={() => persist({ ai_favor: c.ai_favor + 1 })}>+</button>
          </div>
        </div>
      </section>

      {/* Race & Class */}
      <RaceClassPanel character={c} onApply={(patch) => persist(patch)} />

      {/* Health & Mana */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-3 font-semibold">Health Bar</h2>
        <HbTracker
          slots={10}
          slotValue={hbSlotValue}
          current={c.current_hb_slots}
          onChange={(n) => persist({ current_hb_slots: n })}
        />
        {c.current_hb_slots === 0 && (
          <p className="mt-2 text-sm font-semibold text-red-400">
            DYING — countdown {mods.con} rounds; −1 per Clean Up and per damage instance. Heal to
            ≥10% (1 slot) to survive.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <input
            type="number"
            placeholder="Damage"
            value={damageIn}
            onChange={(e) => setDamageIn(e.target.value)}
            className="w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
          <label className="text-xs text-zinc-400">
            DR{" "}
            <input
              type="number"
              value={drIn}
              onChange={(e) => setDrIn(e.target.value)}
              className="w-14 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
            />
          </label>
          <button onClick={applyDamage} className="rounded bg-red-600 px-3 py-1 font-semibold hover:bg-red-500">
            Apply damage
          </button>
          <span className="text-xs text-zinc-500">
            (damage below one slot&apos;s value ({hbSlotValue}) is lost)
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-400">
            Mana <b className="text-zinc-100">{c.current_mana}/{maxMana}</b>
          </span>
          <button className="rounded bg-zinc-800 px-2 py-1" onClick={() => persist({ current_mana: Math.max(0, c.current_mana - 1) })}>−1</button>
          <button className="rounded bg-zinc-800 px-2 py-1" onClick={() => persist({ current_mana: Math.min(maxMana, c.current_mana + 1) })}>+1</button>
          <span className="mx-2 text-zinc-700">|</span>
          <button onClick={() => persist({ current_hb_slots: Math.min(10, c.current_hb_slots + REST_RULES.healSpellSlots), current_mana: Math.max(0, c.current_mana - 2) })} className="rounded bg-emerald-700 px-2 py-1 hover:bg-emerald-600">
            Cast Heal (2 Mana → +2 slots)
          </button>
          <button onClick={shortRest} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">
            Short rest (+5 slots, +½ Mana)
          </button>
          <button onClick={longRest} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">
            Long rest (full, clear Fatigued)
          </button>
        </div>
      </section>

      {/* Debuffs */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-3 font-semibold">Debuffs</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {c.debuffs.map((d, i) => {
            const def = DEBUFFS.find((x) => x.name === d.name);
            return (
              <span
                key={`${d.name}-${i}`}
                title={def ? `${def.effect} — ${def.duration}` : ""}
                className="inline-flex items-center gap-1 rounded-full border border-red-900 bg-red-950 px-3 py-1 text-xs text-red-300"
              >
                {d.name}
                <button onClick={() => persist({ debuffs: c.debuffs.filter((_, j) => j !== i) })} className="text-red-500 hover:text-white">✕</button>
              </span>
            );
          })}
          {c.debuffs.length === 0 && <span className="text-xs text-zinc-500">None. Lucky you.</span>}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <select value={debuffPick} onChange={(e) => setDebuffPick(e.target.value)} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1">
            {DEBUFFS.map((d) => (
              <option key={d.name} value={d.name} title={d.effect}>
                {d.name}{d.stackable ? " (stackable)" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              const def = DEBUFFS.find((x) => x.name === debuffPick)!;
              if (!def.stackable && c.debuffs.some((d) => d.name === debuffPick)) return;
              persist({ debuffs: [...c.debuffs, { name: debuffPick }] });
            }}
            className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700"
          >
            Add
          </button>
          <span className="text-xs text-zinc-500">
            {DEBUFFS.find((x) => x.name === debuffPick)?.effect} · {DEBUFFS.find((x) => x.name === debuffPick)?.duration}
          </span>
        </div>
      </section>

      {/* Skills */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Skills</h2>
          <div className="flex flex-wrap items-center gap-2">
            <SkillSelect
              exclude={c.skills.map((s) => s.name)}
              onPick={(cs: CatalogSkill) =>
                persist({
                  skills: [
                    ...c.skills,
                    {
                      name: cs.name,
                      category: cs.category,
                      stat: cs.stat,
                      check_type: cs.checkType,
                      rank: 0,
                      marked: false,
                      notes: [cs.damage, cs.range, cs.effect].filter(Boolean).join(" · ") || undefined,
                    },
                  ],
                })
              }
            />
            <button
              onClick={() => persist({ skills: c.skills.map((s) => ({ ...s, marked: false })) })}
              className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
              title="After advancement checks, erase all marks"
            >
              Clear marks
            </button>
            <button
              onClick={() =>
                persist({
                  skills: [
                    ...c.skills,
                    { name: "New skill", category: "utility", stat: "int", check_type: "unopposed", rank: 0, marked: false },
                  ],
                })
              }
              className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
            >
              + Add
            </button>
          </div>
        </div>
        <p className="mb-2 text-xs text-zinc-500">
          Any attempt marks a skill. Advancement: 1d20 ≥ current rank → +1 rank (rank ≤4 every 2 h
          of play; rank ≥5 at end of floor). Rank cap 15 on Floors 1–5.
        </p>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-zinc-500">
            <tr>
              <th className="py-1">Skill</th>
              <th>Stat</th>
              <th>Rank</th>
              <th>Check bonus</th>
              <th>Marked</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {c.skills.map((s, i) => (
              <tr key={i} className="border-t border-zinc-800">
                <td className="py-1">
                  <input value={s.name} onChange={(e) => updateSkill(i, { name: e.target.value })} className="w-full bg-transparent outline-none" />
                </td>
                <td className="text-xs uppercase text-zinc-400">{s.stat ?? "—"}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={s.rank}
                    onChange={(e) => updateSkill(i, { rank: Number(e.target.value) })}
                    className="w-12 rounded border border-zinc-800 bg-zinc-950 px-1 text-center"
                  />
                </td>
                <td className="font-mono text-emerald-400">
                  {s.check_type === "passive"
                    ? "passive"
                    : `d20 +${s.rank + (s.stat ? mods[s.stat as StatKey] : 0)}`}
                </td>
                <td>
                  <input type="checkbox" checked={s.marked} onChange={(e) => updateSkill(i, { marked: e.target.checked })} />
                </td>
                <td>
                  <button onClick={() => persist({ skills: c.skills.filter((_, j) => j !== i) })} className="text-zinc-600 hover:text-red-400">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Spells */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Spells</h2>
          <SpellSelect
            exclude={c.spells.map((s) => s.name)}
            onPick={(sp: CatalogSpell) =>
              persist({
                spells: [
                  ...c.spells,
                  { name: sp.name, mana: sp.mana, range: sp.range, effect: sp.effect, rank: 1, notes: sp.type } as SpellRow,
                ],
              })
            }
          />
        </div>
        <p className="mb-2 text-xs text-zinc-500">
          Attack spells roll d20 + Rank + INT Mod vs. Evade and add INT to damage. Must be in the
          Hotlist to cast in combat; can&apos;t be used untrained.
        </p>
        <ul className="space-y-1 text-sm">
          {c.spells.map((sp, i) => {
            const affordable = c.current_mana >= sp.mana;
            return (
              <li key={`${sp.name}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                <span>
                  <b>{sp.name}</b>
                  <span className="ml-2 text-xs text-zinc-400">
                    Rank{" "}
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={sp.rank}
                      onChange={(e) =>
                        persist({ spells: c.spells.map((s, j) => (j === i ? { ...s, rank: Number(e.target.value) } : s)) })
                      }
                      className="w-10 rounded border border-zinc-800 bg-zinc-900 px-1 text-center"
                    />{" "}
                    · {sp.mana} Mana · {sp.range} · {sp.effect}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {sp.notes === "attack" && (
                    <span className="font-mono text-xs text-emerald-400">d20 +{sp.rank + mods.int}</span>
                  )}
                  <button
                    disabled={!affordable}
                    onClick={() =>
                      persist({
                        current_mana: Math.max(0, c.current_mana - sp.mana),
                        ...(sp.name === "Heal"
                          ? { current_hb_slots: Math.min(10, c.current_hb_slots + REST_RULES.healSpellSlots) }
                          : {}),
                      })
                    }
                    className="rounded bg-indigo-700 px-2 py-0.5 text-xs font-semibold hover:bg-indigo-600 disabled:opacity-40"
                    title={affordable ? `Spend ${sp.mana} Mana` : "Not enough Mana"}
                  >
                    Cast
                  </button>
                  {sp.name !== "Heal" && (
                    <button
                      onClick={() => persist({ spells: c.spells.filter((_, j) => j !== i) })}
                      className="text-zinc-600 hover:text-red-400"
                    >
                      ✕
                    </button>
                  )}
                </span>
              </li>
            );
          })}
          {c.spells.length === 0 && <li className="text-xs text-zinc-500">No spells known.</li>}
        </ul>
      </section>

      {/* Wallet + notes */}
      <section className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["gold", "Gold"],
            ["misc_junk", "Misc. Junk"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
            <div className="text-xs uppercase text-zinc-500">{label}</div>
            <div className="mt-1 flex items-center gap-2">
              <button className="rounded bg-zinc-800 px-2" onClick={() => persist({ [key]: Math.max(0, c[key] - 1) } as Partial<Character>)}>−</button>
              <input
                type="number"
                value={c[key]}
                onChange={(e) => persist({ [key]: Math.max(0, Number(e.target.value)) } as Partial<Character>)}
                className="w-20 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-center"
              />
              <button className="rounded bg-zinc-800 px-2" onClick={() => persist({ [key]: c[key] + 1 } as Partial<Character>)}>+</button>
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
          <div className="text-xs uppercase text-zinc-500">Level / Floor</div>
          <div className="mt-1 flex items-center gap-2">
            <input type="number" min={1} max={250} value={c.level} onChange={(e) => persist({ level: Number(e.target.value) })} className="w-16 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-center" />
            <span className="text-zinc-500">/</span>
            <input type="number" min={1} value={c.floor} onChange={(e) => persist({ floor: Number(e.target.value) })} className="w-16 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-center" />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-2 font-semibold">Notes</h2>
        <textarea
          value={c.notes ?? ""}
          onChange={(e) => setC({ ...c, notes: e.target.value })}
          onBlur={(e) => persist({ notes: e.target.value })}
          rows={4}
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
          placeholder="Past Trauma, Loose End, Regret, gear, achievements…"
        />
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <Sheet />
    </AuthGate>
  );
}
