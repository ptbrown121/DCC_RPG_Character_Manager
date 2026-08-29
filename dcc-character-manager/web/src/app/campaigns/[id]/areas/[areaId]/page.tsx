"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AuthGate, { useUser } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";
import {
  AREA_SECTIONS,
  AREA_PHASES,
  BOSS_TIERS,
  BOSS_TIER_LABELS,
  NPC_KINDS,
  bossHbSlots,
  statBudget,
  statMod,
  damageDiceForLevel,
  mobDr,
  mobMove,
  emptyScores,
  STAT_KEYS,
  BOSS_BOX,
  type BossTier,
  type StatScores,
} from "@/lib/rules";
import type { BossEntry, CampaignArea, Character, NpcEntry } from "@/lib/types";

function emptyBoss(): BossEntry {
  return { name: "", level: 30, tier: "neighborhood", clues: "", phases: "", defeated: false };
}

function emptyNpc(): NpcEntry {
  return { name: "", title: "", level: null, kind: "ai-card", notes: "" };
}

/** Spread a boss's stat budget evenly across the five scores (GM can tweak in the runner). */
function evenBossStats(level: number, tier: BossTier): StatScores {
  const { total } = statBudget(level, tier);
  const per = Math.floor(total / 5);
  const rem = total - per * 5;
  const scores = emptyScores(per);
  STAT_KEYS.slice(0, rem).forEach((k) => (scores[k] = per + 1));
  return scores;
}

function AreaEditor() {
  const { id, areaId } = useParams<{ id: string; areaId: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [area, setArea] = useState<CampaignArea | null>(null);
  const [floorNumber, setFloorNumber] = useState<number>(1);
  const [party, setParty] = useState<Character[]>([]);
  const [launching, setLaunching] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    const sb = supabase();
    sb.from("campaign_areas")
      .select("*")
      .eq("id", areaId)
      .single()
      .then(async ({ data }) => {
        const a = data as CampaignArea;
        setArea(a);
        if (a) {
          const { data: floor } = await sb
            .from("campaign_floors")
            .select("floor_number")
            .eq("id", a.floor_id)
            .single();
          if (floor) setFloorNumber(floor.floor_number);
        }
      });
    sb.from("characters").select("*").eq("campaign_id", id).then(({ data }) => setParty((data as Character[]) ?? []));
  }, [areaId, id]);

  async function runBossEncounter(boss: BossEntry) {
    if (!user || !area || launching) return;
    setLaunching(true);
    const sb = supabase();
    const tier = (boss.tier || "neighborhood") as BossTier;
    const { data: enc, error } = await sb
      .from("encounters")
      .insert({
        owner_id: user.id,
        name: `${area.name} — ${boss.name || "Boss"}`,
        floor: floorNumber,
        party_size: Math.max(2, party.length || 4),
        strength: "strong",
        campaign_id: id,
        area_id: area.id,
        notes: [boss.clues && `Clues: ${boss.clues}`, boss.phases && `Phases: ${boss.phases}`]
          .filter(Boolean)
          .join("\n"),
      })
      .select("id")
      .single();
    if (error || !enc) {
      setLaunching(false);
      return;
    }
    const stats = evenBossStats(boss.level, tier);
    const slots = bossHbSlots(tier, floorNumber);
    const rows: Record<string, unknown>[] = [
      {
        encounter_id: enc.id,
        owner_id: user.id,
        kind: "boss",
        name: boss.name || "Boss",
        level: boss.level,
        size: 4,
        boss_tier: tier,
        is_elite: true,
        stats,
        hb_slots: slots,
        slot_value: Math.max(1, statMod(stats.con)),
        current_slots: slots,
        dr: mobDr(floorNumber),
        move_ft: mobMove(4),
        attacks: [
          {
            name: "Attack",
            dice: damageDiceForLevel(boss.level),
            die: 6,
            bonus: statMod(stats.str),
            damage_type: "Bludgeoning",
          },
        ],
        abilities: boss.phases || null,
        sort: 0,
      },
      ...party.map((ch, i) => ({
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
        sort: i + 1,
      })),
    ];
    await sb.from("encounter_combatants").insert(rows);
    router.push(`/encounters/${enc.id}`);
  }

  const persist = useCallback(async (patch: Partial<CampaignArea>) => {
    setArea((prev) => (prev ? { ...prev, ...patch } : prev));
    setSaveState("saving");
    const { error } = await supabase().from("campaign_areas").update(patch).eq("id", areaId);
    setSaveState(error ? "error" : "saved");
  }, [areaId]);

  if (!area) return <p className="text-zinc-400">Loading…</p>;

  function patchBoss(i: number, patch: Partial<BossEntry>) {
    if (!area) return;
    persist({ bosses: area.bosses.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  }

  function patchNpc(i: number, patch: Partial<NpcEntry>) {
    if (!area) return;
    persist({ npcs: area.npcs.map((n, j) => (j === i ? { ...n, ...patch } : n)) });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link href={`/campaigns/${id}`} className="text-sm text-zinc-500 hover:text-zinc-300">← Campaign</Link>
        <input
          value={area.name}
          onChange={(e) => setArea({ ...area, name: e.target.value })}
          onBlur={(e) => persist({ name: e.target.value })}
          className="rounded border border-transparent bg-transparent text-2xl font-bold outline-none hover:border-zinc-700"
        />
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs uppercase text-zinc-400">{area.kind}</span>
        <select
          value={area.status}
          onChange={(e) => persist({ status: e.target.value as CampaignArea["status"] })}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
        >
          {(["unexplored", "active", "cleared"] as const).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-zinc-500">
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "⚠ Save failed" : saveState === "saved" ? "Saved" : ""}
        </span>
      </header>

      <p className="text-xs text-zinc-500">Player arc: {AREA_PHASES.join(" → ")}. All sections optional — fill what the table needs.</p>

      {/* Bosses */}
      <section className="rounded-lg border border-red-950 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Boss Battle(s)</h2>
          <button onClick={() => persist({ bosses: [...area.bosses, emptyBoss()] })} className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">
            + Add boss
          </button>
        </div>
        <p className="mb-2 text-xs text-zinc-500">
          Multiple bosses per area are legal (boss menus, dual bosses). Clues feed the Look for
          Clues action (3 recommended); use phases for HB-threshold changes.
        </p>
        <div className="space-y-3">
          {area.bosses.map((b, i) => (
            <div key={i} className={`rounded border p-3 ${b.defeated ? "border-zinc-800 opacity-60" : "border-red-900"}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input placeholder="Boss name" value={b.name} onChange={(e) => patchBoss(i, { name: e.target.value })} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-semibold" />
                <label className="text-xs text-zinc-400">
                  Lv{" "}
                  <input type="number" min={1} value={b.level} onChange={(e) => patchBoss(i, { level: Number(e.target.value) })} className="w-16 rounded border border-zinc-700 bg-zinc-800 px-1 py-1 text-center" />
                </label>
                <select value={b.tier} onChange={(e) => patchBoss(i, { tier: e.target.value })} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs">
                  {BOSS_TIERS.map((t) => (
                    <option key={t} value={t}>{BOSS_TIER_LABELS[t as BossTier]} (+{["neighborhood", "borough", "city", "province", "country", "floor"].indexOf(t) + 1} levels)</option>
                  ))}
                </select>
                <button
                  onClick={() => runBossEncounter(b)}
                  disabled={launching || b.defeated}
                  title={`Generates the boss via the GM formulas (even stat spread, HB from Table 50, damage from Table 51) and adds the ${party.length ? "party" : "party (none assigned yet)"}`}
                  className="ml-auto rounded bg-red-700 px-2 py-1 text-xs font-semibold hover:bg-red-600 disabled:opacity-40"
                >
                  {launching ? "…" : "⚔ Run as encounter"}
                </button>
                <label className="flex items-center gap-1 text-xs text-zinc-400" title={`Killing blow earns a ${BOSS_BOX[(b.tier || "neighborhood") as BossTier]} Boss Box; whole party gains the tier's levels`}>
                  <input type="checkbox" checked={b.defeated} onChange={(e) => patchBoss(i, { defeated: e.target.checked })} />
                  defeated {b.defeated && `💀 (${BOSS_BOX[(b.tier || "neighborhood") as BossTier]} Boss Box)`}
                </label>
                <button onClick={() => persist({ bosses: area.bosses.filter((_, j) => j !== i) })} className="text-zinc-600 hover:text-red-400">✕</button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <textarea placeholder="Clues (3 for Look for Clues)…" value={b.clues} onChange={(e) => setArea({ ...area, bosses: area.bosses.map((x, j) => (j === i ? { ...x, clues: e.target.value } : x)) })} onBlur={(e) => patchBoss(i, { clues: e.target.value })} rows={2} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs" />
                <textarea placeholder="Phases / arena / tactics…" value={b.phases} onChange={(e) => setArea({ ...area, bosses: area.bosses.map((x, j) => (j === i ? { ...x, phases: e.target.value } : x)) })} onBlur={(e) => patchBoss(i, { phases: e.target.value })} rows={2} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs" />
              </div>
            </div>
          ))}
          {area.bosses.length === 0 && <p className="text-xs text-zinc-600">No bosses yet.</p>}
        </div>
      </section>

      {/* Template sections */}
      <section className="grid gap-3 md:grid-cols-2">
        {AREA_SECTIONS.filter((s) => s.key !== "boss_battle").map((s) => {
          const label = area.kind === "quest" && s.questLabel ? s.questLabel : s.label;
          return (
            <div key={s.key} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <div className="mb-1 text-xs font-semibold uppercase text-zinc-500">{label}</div>
              <textarea
                value={area.sections[s.key] ?? ""}
                onChange={(e) => setArea({ ...area, sections: { ...area.sections, [s.key]: e.target.value } })}
                onBlur={(e) => persist({ sections: { ...area.sections, [s.key]: e.target.value } })}
                rows={3}
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm"
              />
            </div>
          );
        })}
      </section>

      {/* NPCs */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">NPCs</h2>
          <button onClick={() => persist({ npcs: [...area.npcs, emptyNpc()] })} className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">
            + Add NPC
          </button>
        </div>
        <div className="space-y-2">
          {area.npcs.map((n, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded border border-zinc-800 bg-zinc-950 p-2 text-sm">
              <input placeholder="Name" value={n.name} onChange={(e) => patchNpc(i, { name: e.target.value })} className="w-36 rounded border border-zinc-700 bg-zinc-800 px-2 py-1" />
              <input placeholder="Title" value={n.title} onChange={(e) => patchNpc(i, { title: e.target.value })} className="w-44 rounded border border-zinc-700 bg-zinc-800 px-2 py-1" />
              <input type="number" placeholder="Lv" value={n.level ?? ""} onChange={(e) => patchNpc(i, { level: e.target.value === "" ? null : Number(e.target.value) })} className="w-16 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-center" />
              <select value={n.kind} onChange={(e) => patchNpc(i, { kind: e.target.value as NpcEntry["kind"] })} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs">
                {NPC_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
              <input placeholder="Services / hooks / recurring trait" value={n.notes} onChange={(e) => patchNpc(i, { notes: e.target.value })} className="min-w-40 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs" />
              <button onClick={() => persist({ npcs: area.npcs.filter((_, j) => j !== i) })} className="text-zinc-600 hover:text-red-400">✕</button>
            </div>
          ))}
          {area.npcs.length === 0 && <p className="text-xs text-zinc-600">No NPCs yet.</p>}
        </div>
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <AreaEditor />
    </AuthGate>
  );
}
