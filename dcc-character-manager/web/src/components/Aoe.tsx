"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useDroppable } from "@dnd-kit/core";
import { supabase } from "@/lib/supabase";
import { listen, privateChannel, topics } from "@/lib/realtime";
import { assetUrl } from "@/lib/upload";
import { aoeRadiusPx } from "@/lib/stage";
import type { AoeMarker, AssetRow, MapGrid, MapRow } from "@/lib/types";

/*
 * AoE blast markers (T12): bombs dragged from the hotbar onto the tactical
 * map. Markers persist to maps.aoe (migration 0014) through SECURITY DEFINER
 * RPCs — members add (thrower stamped server-side), the GM removes anything,
 * a thrower only their own. Live sync rides broadcast channel `aoe:<mapId>`
 * (own topic — channels never share a hook instance, T7 lesson) with
 * `aoe_add` / `aoe_remove`. Damage stays manual: the ring shows WHERE,
 * the GM adjudicates.
 */

/** Droppable id the hotbar's DndContext resolves map drops against. */
export const MAP_DROP_ID = "map-stage";

export function useMapAoe(map: MapRow | null) {
  const [markers, setMarkers] = useState<AoeMarker[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Seed once per map id — stale row objects from grid edits must not clobber.
  const seededFor = useRef<string | null>(null);

  /** False before migration 0014 (no aoe column on the row). */
  const enabled = map !== null && map.aoe !== undefined;

  useEffect(() => {
    if (map && seededFor.current !== map.id) {
      seededFor.current = map.id;
      setMarkers(map.aoe ?? []);
    }
  }, [map]);

  const mapId = map?.id ?? null;
  useEffect(() => {
    if (!mapId) return;
    const sb = supabase();
    const ch = privateChannel(topics.aoe(mapId))
      .on("broadcast", { event: "aoe_add" }, ({ payload }) => {
        const m = payload as AoeMarker;
        setMarkers((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      })
      .on("broadcast", { event: "aoe_remove" }, ({ payload }) => {
        const { id } = payload as { id: string };
        setMarkers((prev) => prev.filter((m) => m.id !== id));
      });
    listen(ch);
    channelRef.current = ch;
    return () => {
      sb.removeChannel(ch);
      channelRef.current = null;
    };
  }, [mapId]);

  const send = useCallback((event: string, payload: unknown) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  /** Optimistic add + broadcast + RPC persist. False when 0014 hasn't run. */
  const addMarker = useCallback(
    async (marker: AoeMarker): Promise<boolean> => {
      if (!enabled || !mapId) return false;
      setMarkers((prev) => [...prev, marker]);
      send("aoe_add", marker);
      const { error } = await supabase().rpc("add_aoe_marker", { p_map: mapId, p_marker: marker });
      if (error) {
        setMarkers((prev) => prev.filter((m) => m.id !== marker.id));
        send("aoe_remove", { id: marker.id });
        return false;
      }
      return true;
    },
    [enabled, mapId, send],
  );

  const removeMarker = useCallback(
    async (id: string) => {
      if (!mapId) return;
      setMarkers((prev) => prev.filter((m) => m.id !== id));
      send("aoe_remove", { id });
      await supabase().rpc("remove_aoe_marker", { p_map: mapId, p_marker_id: id });
    },
    [mapId, send],
  );

  return { markers, enabled, addMarker, removeMarker };
}

/** Blast rings between drawings and tokens: amber pulse scaled by the grid,
 * item icon at center, effect note in the tooltip, ✕ for whoever may clear. */
export function AoeLayer({
  markers,
  grid,
  assets,
  canRemove,
  onRemove,
}: {
  markers: AoeMarker[];
  grid: MapGrid;
  assets: Record<string, AssetRow>;
  canRemove?: (m: AoeMarker) => boolean;
  onRemove?: (id: string) => void;
}) {
  return (
    <g pointerEvents="none">
      {markers.map((m) => {
        const r = Math.max(aoeRadiusPx(m.radiusFt, grid.ftPerSquare, grid.pxPerSquare), grid.pxPerSquare * 0.3);
        const asset = m.assetId ? assets[m.assetId] : undefined;
        const icon = Math.min(r, grid.pxPerSquare) * 0.9;
        const removable = canRemove?.(m) && onRemove;
        return (
          <g key={m.id}>
            <title>{`${m.label} — ${m.radiusFt} ft blast radius${m.note ? ` — ${m.note}` : ""}`}</title>
            <circle cx={m.x} cy={m.y} r={r} fill="#f59e0b" opacity={0.12} />
            <circle
              cx={m.x}
              cy={m.y}
              r={r}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={Math.max(2, grid.pxPerSquare / 30)}
              className="animate-pulse"
            />
            {asset ? (
              <image
                href={assetUrl(asset.storage_path)}
                x={m.x - icon / 2}
                y={m.y - icon / 2}
                width={icon}
                height={icon}
              />
            ) : (
              <text x={m.x} y={m.y} textAnchor="middle" dominantBaseline="central" fontSize={icon * 0.8}>
                💥
              </text>
            )}
            <text
              x={m.x}
              y={m.y + r + grid.pxPerSquare * 0.25}
              textAnchor="middle"
              fontSize={Math.max(10, grid.pxPerSquare * 0.22)}
              fill="#fbbf24"
              stroke="#000"
              strokeWidth={0.5}
              paintOrder="stroke"
              className="font-display"
            >
              {m.label}
            </text>
            {removable && (
              <g
                transform={`translate(${m.x + r * 0.7071}, ${m.y - r * 0.7071})`}
                pointerEvents="auto"
                style={{ cursor: "pointer" }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onRemove(m.id)}
              >
                <circle r={Math.max(9, grid.pxPerSquare * 0.15)} fill="#18181b" stroke="#71717a" />
                <text textAnchor="middle" dominantBaseline="central" fontSize={Math.max(10, grid.pxPerSquare * 0.18)} fill="#f87171">
                  ✕
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

/**
 * Wraps the player's map stage as the hotbar DndContext's drop target.
 * Highlights while a drag hovers it; HotbarDnd resolves drops on MAP_DROP_ID.
 */
export function MapDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: MAP_DROP_ID });
  return (
    <div
      ref={setNodeRef}
      className={isOver && active ? "ring-2 ring-inset ring-amber-500/70" : undefined}
    >
      {children}
    </div>
  );
}
