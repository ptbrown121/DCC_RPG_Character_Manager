"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { assetUrl } from "@/lib/upload";
import { useUser } from "./AuthGate";
import { AssetPicker } from "./AssetLibrary";
import { MapStage } from "./MapStage";
import type { AssetRow, Campaign, MapGrid, MapRow } from "@/lib/types";

export const DEFAULT_GRID: MapGrid = { ftPerSquare: 5, pxPerSquare: 100, offsetX: 0, offsetY: 0, show: true };

/** Live grid-calibration preview: the real pan/zoom stage, GM's-eye view. */
function MapPreview({ map, asset }: { map: MapRow; asset: AssetRow | undefined }) {
  if (!asset) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded border border-zinc-800 bg-zinc-950 text-xs text-zinc-600">
        Background image missing (asset deleted?)
      </div>
    );
  }
  return (
    <MapStage
      imageUrl={assetUrl(asset.storage_path)}
      width={asset.width}
      height={asset.height}
      grid={map.grid}
      className="h-80 w-full rounded border border-zinc-800"
    />
  );
}

function GridEditor({ map, onPatch }: { map: MapRow; onPatch: (patch: Partial<MapRow>) => void }) {
  const g = map.grid;
  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const set = (patch: Partial<MapGrid>) => onPatch({ grid: { ...g, ...patch } });
  return (
    <div className="flex flex-wrap items-end gap-3 text-xs">
      <label className="flex flex-col gap-1 text-zinc-400">
        Name
        <input
          value={map.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          className="w-40 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200"
        />
      </label>
      <label className="flex flex-col gap-1 text-zinc-400">
        ft / square
        <input
          type="number"
          value={g.ftPerSquare}
          min={1}
          onChange={(e) => set({ ftPerSquare: Math.max(1, num(e.target.value, 5)) })}
          className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200"
        />
      </label>
      <label className="flex flex-col gap-1 text-zinc-400">
        px / square
        <input
          type="number"
          value={g.pxPerSquare}
          min={5}
          onChange={(e) => set({ pxPerSquare: Math.max(5, num(e.target.value, 100)) })}
          className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200"
        />
      </label>
      <label className="flex flex-col gap-1 text-zinc-400">
        offset X
        <input
          type="number"
          value={g.offsetX}
          onChange={(e) => set({ offsetX: num(e.target.value, 0) })}
          className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200"
        />
      </label>
      <label className="flex flex-col gap-1 text-zinc-400">
        offset Y
        <input
          type="number"
          value={g.offsetY}
          onChange={(e) => set({ offsetY: num(e.target.value, 0) })}
          className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200"
        />
      </label>
      <label className="flex items-center gap-1 pb-1 text-zinc-300">
        <input type="checkbox" checked={g.show} onChange={(e) => set({ show: e.target.checked })} />
        show grid
      </label>
    </div>
  );
}

/** GM's map list for a campaign: create from an asset, calibrate grid, set active. */
export function MapManager({
  campaign,
  onPatchCampaign,
}: {
  campaign: Campaign;
  onPatchCampaign: (patch: Partial<Campaign>) => void;
}) {
  const { user } = useUser();
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [assets, setAssets] = useState<Record<string, AssetRow>>({});
  const [picker, setPicker] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = supabase();
      const [{ data: mapRows }, { data: assetRows }] = await Promise.all([
        sb.from("maps").select("*").eq("campaign_id", campaign.id).order("created_at"),
        sb.from("assets").select("*").eq("campaign_id", campaign.id),
      ]);
      if (cancelled) return;
      setMaps((mapRows as MapRow[]) ?? []);
      setAssets(Object.fromEntries(((assetRows as AssetRow[]) ?? []).map((a) => [a.id, a])));
    })();
    return () => {
      cancelled = true;
    };
  }, [campaign.id]);

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase().removeChannel(channelRef.current);
      channelRef.current = null;
    };
  }, []);

  /** Tell open player sheets which map is live now (they also read the row on load). */
  async function broadcastActive(activeMapId: string | null) {
    if (!channelRef.current) {
      const ch = supabase().channel(`hud:campaign:${campaign.id}`);
      await new Promise<void>((resolve) =>
        ch.subscribe((s) => {
          if (s === "SUBSCRIBED") resolve();
        }),
      );
      channelRef.current = ch;
    }
    await channelRef.current.send({ type: "broadcast", event: "map_state", payload: { activeMapId } });
  }

  async function createFromAsset(asset: AssetRow) {
    if (!user) return;
    setPicker(false);
    const { data } = await supabase()
      .from("maps")
      .insert({
        campaign_id: campaign.id,
        owner_id: user.id,
        name: asset.name,
        asset_id: asset.id,
        grid: DEFAULT_GRID,
      })
      .select("*")
      .single();
    if (data) {
      const row = data as MapRow;
      setAssets((prev) => ({ ...prev, [asset.id]: asset }));
      setMaps((prev) => [...prev, row]);
      setOpenId(row.id);
    }
  }

  async function patchMap(id: string, patch: Partial<MapRow>) {
    setMaps((rows) => rows.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    await supabase().from("maps").update(patch).eq("id", id);
  }

  async function setActive(id: string | null) {
    onPatchCampaign({ active_map_id: id });
    await broadcastActive(id);
  }

  async function deleteMap(map: MapRow) {
    if (!window.confirm(`Delete map “${map.name}”? Drawings on it are lost.`)) return;
    if (campaign.active_map_id === map.id) await setActive(null);
    setMaps((rows) => rows.filter((m) => m.id !== map.id));
    await supabase().from("maps").delete().eq("id", map.id);
  }

  const migrationMissing = campaign.active_map_id === undefined;

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-1 flex items-center gap-3">
        <h2 className="font-display font-semibold tracking-wider text-emerald-300">▚ MAPS ▞</h2>
        <button
          onClick={() => setPicker(true)}
          className="ml-auto rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
        >
          + New map from image
        </button>
      </div>
      <p className="mb-3 text-xs text-zinc-400">
        The <b className="text-emerald-400">active</b> map is what the party sees on their sheets.
        Calibrate the grid so distances in feet come out right ({DEFAULT_GRID.ftPerSquare} ft per
        square is the book standard).
      </p>
      {migrationMissing && (
        <p className="mb-2 text-xs text-amber-400">Run migration 0010 to enable maps.</p>
      )}

      <ul className="space-y-2">
        {maps.map((m) => {
          const active = campaign.active_map_id === m.id;
          const asset = m.asset_id ? assets[m.asset_id] : undefined;
          return (
            <li key={m.id} className={`rounded border p-3 ${active ? "border-emerald-700" : "border-zinc-800"}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  onClick={() => setOpenId(openId === m.id ? null : m.id)}
                  className="font-semibold hover:text-amber-300"
                  title="Edit grid"
                >
                  {openId === m.id ? "▾" : "▸"} {m.name}
                </button>
                {active && <span className="rounded-full border border-emerald-700 px-2 py-0.5 text-[10px] text-emerald-300">ACTIVE</span>}
                {asset && <span className="text-[10px] text-zinc-500">{asset.width}×{asset.height}px</span>}
                <span className="ml-auto flex items-center gap-1 text-xs">
                  {active ? (
                    <button onClick={() => setActive(null)} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">
                      Hide from party
                    </button>
                  ) : (
                    <button
                      onClick={() => setActive(m.id)}
                      disabled={migrationMissing}
                      className="rounded bg-emerald-700 px-2 py-1 font-semibold hover:bg-emerald-600 disabled:opacity-40"
                    >
                      Set active
                    </button>
                  )}
                  <button onClick={() => deleteMap(m)} className="rounded px-1 text-zinc-600 hover:text-red-400" title="Delete map">
                    ✕
                  </button>
                </span>
              </div>
              {openId === m.id && (
                <div className="mt-3 space-y-3 border-t border-zinc-800 pt-3">
                  <GridEditor map={m} onPatch={(patch) => patchMap(m.id, patch)} />
                  <MapPreview map={m} asset={asset} />
                </div>
              )}
            </li>
          );
        })}
        {maps.length === 0 && (
          <li className="text-xs text-zinc-600">No maps yet — create one from an uploaded image.</li>
        )}
      </ul>

      {picker && (
        <AssetPicker
          campaignId={campaign.id}
          kinds={["map", "misc"]}
          title="Map background"
          onPick={createFromAsset}
          onClose={() => setPicker(false)}
        />
      )}
    </section>
  );
}
