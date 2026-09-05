"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { listen, privateChannel, topics } from "@/lib/realtime";
import type { MapGrid, MapRow } from "@/lib/types";

/*
 * Live map metadata (T13), on two private topics (hooks never share a
 * channel instance, and each topic has one owner hook):
 * - `mapmeta:<mapId>` / `map_patch`: the GM's grid/name edits push to open
 *   player sheets, so recalibrating a live map no longer needs a reload
 *   (the old T5 gap). GM-only publish (0016).
 * - `ping:<mapId>` / `ping`: shift+click "look HERE" flash, from anyone at
 *   the table — its own topic because Realtime authorizes per topic.
 * Both are ephemeral; grid changes are persisted separately by the GM's
 * normal map write, and pings are meant to vanish.
 */

export interface MapPing {
  id: string;
  x: number;
  y: number;
}

export type MapLivePatch = Partial<Pick<MapRow, "grid" | "name">>;

const PING_MS = 2400;

export function useMapMeta(mapId: string | null, onPatch?: (patch: MapLivePatch) => void) {
  const [pings, setPings] = useState<MapPing[]>([]);
  const metaRef = useRef<RealtimeChannel | null>(null);
  const pingRef = useRef<RealtimeChannel | null>(null);
  const cb = useRef(onPatch);
  useEffect(() => {
    cb.current = onPatch;
  });

  const expire = useCallback((id: string) => {
    setTimeout(() => setPings((prev) => prev.filter((p) => p.id !== id)), PING_MS);
  }, []);

  useEffect(() => {
    if (!mapId) return;
    const sb = supabase();
    const meta = privateChannel(topics.mapMeta(mapId)).on("broadcast", { event: "map_patch" }, ({ payload }) =>
      cb.current?.(payload as MapLivePatch),
    );
    const ping = privateChannel(topics.ping(mapId)).on("broadcast", { event: "ping" }, ({ payload }) => {
      const p = payload as MapPing;
      setPings((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]));
      expire(p.id);
    });
    listen(meta);
    listen(ping);
    metaRef.current = meta;
    pingRef.current = ping;
    return () => {
      sb.removeChannel(meta);
      sb.removeChannel(ping);
      metaRef.current = null;
      pingRef.current = null;
    };
  }, [mapId, expire]);

  const sendPatch = useCallback((patch: MapLivePatch) => {
    metaRef.current?.send({ type: "broadcast", event: "map_patch", payload: patch });
  }, []);

  const sendPing = useCallback(
    (x: number, y: number) => {
      const p: MapPing = { id: crypto.randomUUID(), x, y };
      setPings((prev) => [...prev, p]);
      expire(p.id);
      pingRef.current?.send({ type: "broadcast", event: "ping", payload: p });
    },
    [expire],
  );

  return { pings, sendPatch, sendPing };
}

export type MapMetaApi = ReturnType<typeof useMapMeta>;

/** Expanding amber rings at ping points; self-removes via the hook's timer. */
export function PingLayer({ pings, grid }: { pings: MapPing[]; grid: MapGrid }) {
  const r0 = Math.max(6, grid.pxPerSquare * 0.25);
  const r1 = grid.pxPerSquare * 1.5;
  return (
    <g pointerEvents="none">
      {pings.map((p) => (
        <g key={p.id}>
          <circle cx={p.x} cy={p.y} r={r0 * 0.5} fill="#fbbf24" />
          <circle
            cx={p.x}
            cy={p.y}
            r={r0}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={Math.max(2, grid.pxPerSquare / 25)}
          >
            <animate attributeName="r" values={`${r0};${r1}`} dur="0.8s" repeatCount="3" />
            <animate attributeName="opacity" values="1;0" dur="0.8s" repeatCount="3" />
          </circle>
        </g>
      ))}
    </g>
  );
}
