"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import HbTracker from "@/components/HbTracker";
import { supabase } from "@/lib/supabase";
import {
  statMod,
  mobEvade,
  mobSurprise,
  mobActions,
  slotsLostToDamage,
  mitigateDamage,
  BOSS_TIER_LABELS,
  DEBUFFS,
  MOB_ADVANTAGE_MOD,
} from "@/lib/rules";
import type { Combatant, Encounter } from "@/lib/types";

const ROUND_STEPS = [
  "1. Mob Action Declaration",
  "2. Crawler Reaction Phase (Interrupts)",
  "3. Mob Action Resolution",
  "4. Crawler Action Phase",
  "5. Clean Up (debuff ticks, dying −1)",
];

function MobCard({
  m,
  floor,
  crawlerCount,
  onPatch,
  onRemove,
}: {
  m: Combatant;
  floor: number;
  crawlerCount: number;
  onPatch: (id: string, patch: Partial<Combatant>) => void;
  onRemove: (id: string) => void;
}) {
  const [dmg, setDmg] = useState("");
  const dead = m.current_slots === 0;
  const stats = m.stats;
  const isBossOrElite = m.kind === "boss" || m.is_elite;

  function applyDamage(bypassDr = false) {
    const raw = Number(dmg);
    if (!raw || raw <= 0) return;
    const after = mitigateDamage(raw, { dr: m.dr, bypassDr });
    const lost = slotsLostToDamage(after, m.slot_value);
    onPatch(m.id, { current_slots: Math.max(0, m.current_slots - lost) });
    setDmg("");
  }

  return (
    <div className={`rounded-lg border p-4 ${dead ? "border-zinc-800 bg-zinc-950 opacity-50" : m.kind === "boss" ? "border-red-900 bg-zinc-900" : "border-zinc-800 bg-zinc-900"}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">
          {dead && "💀 "}
          {m.name}
          <span className="ml-2 text-xs font-normal text-zinc-400">
            Lv {m.level} {m.kind === "boss" ? `${BOSS_TIER_LABELS[m.boss_tier ?? "neighborhood"]} Boss` : m.is_elite ? "Elite" : "Mob"}
          </span>
        </h3>
        <button onClick={() => onRemove(m.id)} className="text-xs text-zinc-600 hover:text-red-400">remove</button>
      </div>

      {stats && (
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-400">
          <span>Evade <b className="text-zinc-200">{mobEvade(stats.dex) + floor}</b></span>
          <span>Surprise <b className="text-zinc-200">{mobSurprise(stats.int) + floor}</b></span>
          <span>DR <b className="text-zinc-200">{m.dr}</b></span>
          <span>Move <b className="text-zinc-200">{m.move_ft} ft</b></span>
          <span>Actions: <b className="text-zinc-200">{mobActions(isBossOrElite, crawlerCount)}</b></span>
        </div>
      )}
      {m.attacks.length > 0 && (
        <div className="mt-1 text-xs text-zinc-400">
          {m.attacks.map((a, i) => (
            <span key={i} className="mr-3">
              {a.name}: <b className="text-amber-300">{a.dice}d{a.die}+{a.bonus}</b> {a.damage_type}
              <span className="text-zinc-600"> · Adv = diff +{MOB_ADVANTAGE_MOD} / Disadv −{MOB_ADVANTAGE_MOD} + free Evade</span>
            </span>
          ))}
        </div>
      )}
      {m.abilities && <p className="mt-1 text-xs italic text-zinc-500">{m.abilities}</p>}

      <div className="mt-2">
        <HbTracker
          slots={m.hb_slots}
          slotValue={m.slot_value}
          current={m.current_slots}
          onChange={(n) => onPatch(m.id, { current_slots: n })}
          compact={m.hb_slots > 12}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <input type="number" placeholder="Damage" value={dmg} onChange={(e) => setDmg(e.target.value)} className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs" />
        <button onClick={() => applyDamage(false)} className="rounded bg-red-700 px-2 py-1 text-xs font-semibold hover:bg-red-600">Hit (−DR {m.dr})</button>
        <button onClick={() => applyDamage(true)} className="rounded bg-red-900 px-2 py-1 text-xs hover:bg-red-800" title="Debuff ticks bypass DR">Tick (no DR)</button>
        <select
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            onPatch(m.id, { debuffs: [...m.debuffs, { name: e.target.value }] });
          }}
          className="rounded border border-zinc-700 bg-zinc-800 px-1 py-1 text-xs"
        >
          <option value="">+ debuff</option>
          {DEBUFFS.map((d) => (
            <option key={d.name} value={d.name}>{d.name}</option>
          ))}
        </select>
      </div>
      {m.debuffs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {m.debuffs.map((d, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-red-950 px-2 py-0.5 text-[10px] text-red-300">
              {d.name}
              <button onClick={() => onPatch(m.id, { debuffs: m.debuffs.filter((_, j) => j !== i) })} className="hover:text-white">✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Runner() {
  const { id } = useParams<{ id: string }>();
  const [enc, setEnc] = useState<Encounter | null>(null);
  const [combatants, setCombatants] = useState<Combatant[]>([]);

  useEffect(() => {
    const sb = supabase();
    sb.from("encounters").select("*").eq("id", id).single().then(({ data }) => setEnc(data as Encounter));
    sb.from("encounter_combatants")
      .select("*")
      .eq("encounter_id", id)
      .order("sort")
      .then(({ data }) => setCombatants((data as Combatant[]) ?? []));
  }, [id]);

  const patchEncounter = useCallback(async (patch: Partial<Encounter>) => {
    setEnc((e) => (e ? ({ ...e, ...patch } as Encounter) : e));
    await supabase().from("encounters").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  }, [id]);

  const patchCombatant = useCallback(async (cid: string, patch: Partial<Combatant>) => {
    setCombatants((rows) => rows.map((r) => (r.id === cid ? ({ ...r, ...patch } as Combatant) : r)));
    await supabase().from("encounter_combatants").update(patch).eq("id", cid);
  }, []);

  const removeCombatant = useCallback(async (cid: string) => {
    setCombatants((rows) => rows.filter((r) => r.id !== cid));
    await supabase().from("encounter_combatants").delete().eq("id", cid);
  }, []);

  if (!enc) return <p className="text-zinc-400">Loading…</p>;

  const mobs = combatants.filter((x) => x.kind !== "crawler");
  const crawlers = combatants.filter((x) => x.kind === "crawler");
  const living = mobs.filter((x) => x.current_slots > 0).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{enc.name}</h1>
          <p className="text-sm text-zinc-400">
            {enc.campaign_id && (
              <Link href={enc.area_id ? `/campaigns/${enc.campaign_id}/areas/${enc.area_id}` : `/campaigns/${enc.campaign_id}`} className="text-amber-400 hover:underline">
                ← {enc.area_id ? "area" : "campaign"}
              </Link>
            )}{" "}
            Floor {enc.floor} · party of {enc.party_size} · {living}/{mobs.length} adversaries standing
          </p>
        </div>
        <div className="flex items-center gap-2">
          {enc.status !== "running" ? (
            <button onClick={() => patchEncounter({ status: "running", round: Math.max(1, enc.round) })} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-500">
              {enc.round > 0 ? "Resume" : "Start combat"}
            </button>
          ) : (
            <>
              <span className="rounded bg-zinc-800 px-3 py-1.5 text-sm">Round <b className="text-amber-400">{enc.round}</b></span>
              <button onClick={() => patchEncounter({ round: enc.round + 1 })} className="rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
                Next round
              </button>
              <button onClick={() => patchEncounter({ status: "done" })} className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700">
                End
              </button>
            </>
          )}
        </div>
      </header>

      {enc.status === "running" && (
        <ol className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs text-zinc-400">
          {ROUND_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Adversaries</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {mobs.map((m) => (
            <MobCard key={m.id} m={m} floor={enc.floor} crawlerCount={crawlers.length || enc.party_size} onPatch={patchCombatant} onRemove={removeCombatant} />
          ))}
          {mobs.length === 0 && <p className="text-sm text-zinc-500">No adversaries.</p>}
        </div>
      </section>

      {crawlers.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Crawlers</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {crawlers.map((cr) => (
              <div key={cr.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">
                    {cr.character_id ? (
                      <Link href={`/characters/${cr.character_id}`} className="hover:text-amber-400">{cr.name}</Link>
                    ) : (
                      cr.name
                    )}
                    <span className="ml-2 text-xs font-normal text-zinc-400">Lv {cr.level}</span>
                  </h3>
                  {cr.stats && (
                    <span className="text-xs text-zinc-400">Evade d20 +{statMod(cr.stats.dex)} · 2 Actions</span>
                  )}
                </div>
                <div className="mt-2">
                  <HbTracker slots={cr.hb_slots} slotValue={cr.slot_value} current={cr.current_slots} onChange={(n) => patchCombatant(cr.id, { current_slots: n })} />
                </div>
                {cr.current_slots === 0 && (
                  <p className="mt-1 text-xs font-semibold text-red-400">DYING — countdown {cr.slot_value ? statMod((cr.stats?.con ?? 1)) : 0} rounds</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-2 font-semibold">GM notes</h2>
        <textarea
          value={enc.notes ?? ""}
          onChange={(e) => setEnc({ ...enc, notes: e.target.value })}
          onBlur={(e) => patchEncounter({ notes: e.target.value })}
          rows={3}
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
          placeholder="Boss clues (Look for Clues), phase triggers, reinforcements…"
        />
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <Runner />
    </AuthGate>
  );
}
