"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";
import { AREA_SECTIONS, AREA_PHASES, BOSS_TIERS, BOSS_TIER_LABELS, NPC_KINDS, type BossTier } from "@/lib/rules";
import type { BossEntry, CampaignArea, NpcEntry } from "@/lib/types";

function emptyBoss(): BossEntry {
  return { name: "", level: 30, tier: "neighborhood", clues: "", phases: "", defeated: false };
}

function emptyNpc(): NpcEntry {
  return { name: "", title: "", level: null, kind: "ai-card", notes: "" };
}

function AreaEditor() {
  const { id, areaId } = useParams<{ id: string; areaId: string }>();
  const [area, setArea] = useState<CampaignArea | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    supabase()
      .from("campaign_areas")
      .select("*")
      .eq("id", areaId)
      .single()
      .then(({ data }) => setArea(data as CampaignArea));
  }, [areaId]);

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
                <label className="ml-auto flex items-center gap-1 text-xs text-zinc-400">
                  <input type="checkbox" checked={b.defeated} onChange={(e) => patchBoss(i, { defeated: e.target.checked })} />
                  defeated {b.defeated && "💀"}
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
