"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AuthGate, { useUser } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";
import {
  DUNGEON_DAY_HOURS,
  floorTotalHours,
  hoursRemaining,
  formatDungeonTime,
  FLOOR_PLANNING,
  trapDamageDice,
  typicalMobLevels,
  typicalBossLevels,
} from "@/lib/rules";
import { statMod } from "@/lib/rules";
import VehiclesPanel from "@/components/VehiclesPanel";
import type { AchievementEntry, Campaign, CampaignArea, CampaignFloor, Character, Encounter } from "@/lib/types";

const FLOOR_STATUS_COLORS: Record<CampaignFloor["status"], string> = {
  upcoming: "text-zinc-500",
  active: "text-emerald-400",
  cleared: "text-sky-400",
  collapsed: "text-red-400",
};

const AREA_STATUS_COLORS: Record<CampaignArea["status"], string> = {
  unexplored: "border-zinc-700 text-zinc-400",
  active: "border-emerald-700 text-emerald-300",
  cleared: "border-sky-700 text-sky-300",
};

function FloorCard({
  floor,
  areas,
  onPatchFloor,
  onAddArea,
}: {
  floor: CampaignFloor;
  areas: CampaignArea[];
  onPatchFloor: (id: string, patch: Partial<CampaignFloor>) => void;
  onAddArea: (floor: CampaignFloor, kind: "neighborhood" | "quest", name: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"neighborhood" | "quest">("neighborhood");
  const remaining = hoursRemaining(floor.collapse_days, floor.hours_elapsed);
  const total = floorTotalHours(floor.collapse_days);
  const pct = total > 0 ? Math.min(100, Math.round((floor.hours_elapsed / total) * 100)) : 0;
  const urgent = floor.status === "active" && remaining <= DUNGEON_DAY_HOURS;
  const mobRange = typicalMobLevels(floor.floor_number);
  const bossRange = typicalBossLevels(floor.floor_number);

  function burn(hours: number) {
    onPatchFloor(floor.id, {
      hours_elapsed: Math.max(0, Math.min(total, floor.hours_elapsed + hours)),
    });
  }

  return (
    <div className={`rounded-lg border bg-zinc-900 p-4 ${floor.status === "active" ? "border-amber-700" : "border-zinc-800"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-bold">Floor {floor.floor_number}</h3>
        <select
          value={floor.status}
          onChange={(e) => onPatchFloor(floor.id, { status: e.target.value as CampaignFloor["status"] })}
          className={`rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs ${FLOOR_STATUS_COLORS[floor.status]}`}
        >
          {(["upcoming", "active", "cleared", "collapsed"] as const).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {floor.janitor && <span className="text-xs text-zinc-500">Janitor: {floor.janitor}</span>}
        <span className="ml-auto text-xs text-zinc-500">
          {mobRange && <>Mobs Lv {mobRange[0]}–{mobRange[1]} · </>}
          {bossRange && <>Bosses Lv {bossRange[0]}–{bossRange[1]} · </>}
          Traps {trapDamageDice(floor.floor_number)}
        </span>
      </div>

      {/* Collapse clock */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className={urgent ? "font-semibold text-red-400" : "text-zinc-400"}>
            {urgent && "⚠ "}Time to Floor Collapse: <b>{formatDungeonTime(remaining)}</b> of{" "}
            {floor.collapse_days}d ({total}h)
          </span>
          <span className="flex items-center gap-1">
            <button onClick={() => burn(-1)} className="rounded bg-zinc-800 px-1.5 py-0.5 hover:bg-zinc-700">−1h</button>
            <button onClick={() => burn(1)} className="rounded bg-zinc-800 px-1.5 py-0.5 hover:bg-zinc-700">+1h</button>
            <button onClick={() => burn(2)} className="rounded bg-zinc-800 px-1.5 py-0.5 hover:bg-zinc-700" title="One 2-hour play block (party levels +1)">+2h block</button>
            <button onClick={() => burn(DUNGEON_DAY_HOURS)} className="rounded bg-zinc-800 px-1.5 py-0.5 hover:bg-zinc-700">+1 day</button>
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded bg-zinc-800">
          <div
            className={`h-full ${pct > 80 ? "bg-red-600" : pct > 50 ? "bg-amber-500" : "bg-emerald-600"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Areas */}
      <div className="mt-3 flex flex-wrap gap-2">
        {areas.map((a) => (
          <Link
            key={a.id}
            href={`/campaigns/${a.campaign_id}/areas/${a.id}`}
            className={`rounded-full border px-3 py-1 text-xs hover:border-amber-500 ${AREA_STATUS_COLORS[a.status]}`}
            title={`${a.kind} — ${a.status}`}
          >
            {a.kind === "quest" ? "❗ " : ""}
            {a.name}
            {a.bosses.some((b) => b.defeated) && " 💀"}
          </Link>
        ))}
        {areas.length === 0 && (
          <span className="text-xs text-zinc-600">
            No areas yet (book guideline: {FLOOR_PLANNING.minNeighborhoods}–{FLOOR_PLANNING.maxNeighborhoods} active neighborhoods per floor).
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <select
          value={newKind}
          onChange={(e) => setNewKind(e.target.value as "neighborhood" | "quest")}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
        >
          <option value="neighborhood">Neighborhood</option>
          <option value="quest">Quest</option>
        </select>
        <input
          placeholder="Area name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) {
              onAddArea(floor, newKind, newName.trim());
              setNewName("");
            }
          }}
          className="w-48 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
        />
        <button
          onClick={() => {
            if (newName.trim()) {
              onAddArea(floor, newKind, newName.trim());
              setNewName("");
            }
          }}
          className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [floors, setFloors] = useState<CampaignFloor[]>([]);
  const [areas, setAreas] = useState<CampaignArea[]>([]);
  const [party, setParty] = useState<Character[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [achName, setAchName] = useState("");
  const [achReward, setAchReward] = useState("");
  const [achBy, setAchBy] = useState("");
  const [achTroll, setAchTroll] = useState(false);

  useEffect(() => {
    const sb = supabase();
    sb.from("campaigns").select("*").eq("id", id).single().then(({ data }) => setCampaign(data as Campaign));
    sb.from("campaign_floors").select("*").eq("campaign_id", id).order("floor_number").then(({ data }) => setFloors((data as CampaignFloor[]) ?? []));
    sb.from("campaign_areas").select("*").eq("campaign_id", id).order("sort").then(({ data }) => setAreas((data as CampaignArea[]) ?? []));
    sb.from("characters").select("*").eq("campaign_id", id).then(({ data }) => setParty((data as Character[]) ?? []));
    sb.from("encounters").select("*").eq("campaign_id", id).order("updated_at", { ascending: false }).then(({ data }) => setEncounters((data as Encounter[]) ?? []));
  }, [id]);

  const patchFloor = useCallback(async (floorId: string, patch: Partial<CampaignFloor>) => {
    setFloors((rows) => rows.map((f) => (f.id === floorId ? { ...f, ...patch } : f)));
    await supabase().from("campaign_floors").update(patch).eq("id", floorId);
  }, []);

  const patchCampaign = useCallback(async (patch: Partial<Campaign>) => {
    setCampaign((c) => (c ? { ...c, ...patch } : c));
    await supabase().from("campaigns").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  }, [id]);

  const addArea = useCallback(
    async (floor: CampaignFloor, kind: "neighborhood" | "quest", name: string) => {
      if (!user) return;
      const { data } = await supabase()
        .from("campaign_areas")
        .insert({
          campaign_id: id,
          floor_id: floor.id,
          owner_id: user.id,
          kind,
          name,
          sort: areas.filter((a) => a.floor_id === floor.id).length,
        })
        .select("*")
        .single();
      if (data) setAreas((rows) => [...rows, data as CampaignArea]);
    },
    [id, user, areas],
  );

  if (!campaign) return <p className="text-zinc-400">Loading…</p>;

  function addAchievement() {
    if (!achName.trim() || !campaign) return;
    const entry: AchievementEntry = {
      name: achName.trim(),
      reward: achTroll ? "" : achReward.trim(),
      troll: achTroll,
      earned_by: achBy.trim(),
      at: new Date().toISOString().slice(0, 10),
    };
    patchCampaign({ achievements: [...campaign.achievements, entry] });
    setAchName("");
    setAchReward("");
    setAchBy("");
    setAchTroll(false);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{campaign.name}</h1>
        <p className="text-sm text-zinc-500">
          Dungeon days are 30 hours. Every 2 hours of play = +1 party level; break points per
          neighborhood/quest; {FLOOR_PLANNING.minSessions}–{FLOOR_PLANNING.maxSessions} sessions per floor.
        </p>
      </header>

      {/* Party */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-2 font-semibold">Party ({party.length})</h2>
        <div className="flex flex-wrap gap-2">
          {party.map((ch) => {
            const conMod = statMod(ch.stats.enhanced.con);
            const low = ch.current_hb_slots <= 3;
            return (
              <Link
                key={ch.id}
                href={`/characters/${ch.id}`}
                className={`rounded-full border px-3 py-1 text-sm hover:border-amber-500 ${low ? "border-red-800 text-red-300" : "border-zinc-700 text-zinc-200"}`}
              >
                {ch.name} <span className="text-xs text-zinc-500">Lv {ch.level} · HB {ch.current_hb_slots}/10 ({ch.current_hb_slots * conMod})</span>
              </Link>
            );
          })}
          {party.length === 0 && (
            <span className="text-xs text-zinc-500">
              No crawlers assigned — set the Campaign field on a character sheet.
            </span>
          )}
        </div>
      </section>

      <section className="space-y-3">
        {floors.map((f) => (
          <FloorCard
            key={f.id}
            floor={f}
            areas={areas.filter((a) => a.floor_id === f.id)}
            onPatchFloor={patchFloor}
            onAddArea={addArea}
          />
        ))}
      </section>

      {/* Linked encounters */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-2 font-semibold">Encounters</h2>
        <ul className="space-y-1 text-sm">
          {encounters.map((e) => (
            <li key={e.id}>
              <Link href={`/encounters/${e.id}`} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 hover:border-amber-600">
                <span>{e.name}</span>
                <span className={`text-xs ${e.status === "running" ? "text-emerald-400" : e.status === "done" ? "text-zinc-500" : "text-amber-400"}`}>
                  Floor {e.floor} · {e.status}{e.round > 0 ? ` · round ${e.round}` : ""}
                </span>
              </Link>
            </li>
          ))}
          {encounters.length === 0 && (
            <li className="text-xs text-zinc-500">None yet — use “Run as encounter” on a boss inside an area.</li>
          )}
        </ul>
      </section>

      {/* Vehicles */}
      <VehiclesPanel
        campaign={campaign}
        floor={floors.find((f) => f.status === "active")?.floor_number ?? 1}
        onPatch={patchCampaign}
      />

      {/* Achievements log */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-2 font-semibold">Achievements earned</h2>
        <ul className="mb-3 space-y-1 text-sm">
          {campaign.achievements.map((a, i) => (
            <li key={i} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5">
              <span>
                <b className={a.troll ? "text-zinc-500 line-through" : "text-amber-300"}>{a.name}</b>
                {a.earned_by && <span className="text-zinc-400"> — {a.earned_by}</span>}
                <span className="ml-2 text-xs text-zinc-500">
                  {a.troll ? "troll achievement (no reward)" : a.reward} · {a.at}
                </span>
              </span>
              <button
                onClick={() => patchCampaign({ achievements: campaign.achievements.filter((_, j) => j !== i) })}
                className="text-zinc-600 hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
          {campaign.achievements.length === 0 && <li className="text-xs text-zinc-500">Nothing earned yet.</li>}
        </ul>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input placeholder="Achievement" value={achName} onChange={(e) => setAchName(e.target.value)} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1" />
          <input placeholder="Reward (box tier…)" value={achReward} onChange={(e) => setAchReward(e.target.value)} disabled={achTroll} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 disabled:opacity-40" />
          <input placeholder="Earned by" value={achBy} onChange={(e) => setAchBy(e.target.value)} className="w-28 rounded border border-zinc-700 bg-zinc-800 px-2 py-1" />
          <label className="flex items-center gap-1 text-zinc-400">
            <input type="checkbox" checked={achTroll} onChange={(e) => setAchTroll(e.target.checked)} /> troll
          </label>
          <button onClick={addAchievement} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">+ Log</button>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-2 font-semibold">Campaign notes</h2>
        <textarea
          value={campaign.notes ?? ""}
          onChange={(e) => setCampaign({ ...campaign, notes: e.target.value })}
          onBlur={(e) => patchCampaign({ notes: e.target.value })}
          rows={4}
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
          placeholder="Leaderboard/bounties, sponsors, show invitations, deity standings, rival crawlers…"
        />
      </section>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <CampaignPage />
    </AuthGate>
  );
}
