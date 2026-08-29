"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { assetUrl } from "@/lib/upload";
import { penStrokeWidth, snapHalf } from "@/lib/stage";
import { useUser } from "./AuthGate";
import { AssetPicker } from "./AssetLibrary";
import { DrawingCapture, DrawingLayer, PEN_COLORS, useMapDrawings } from "./Drawing";
import { MapStage, StageTransformContext } from "./MapStage";
import type { AssetRow, MapGrid, MapRow, TokenRow } from "@/lib/types";

/*
 * Tabletop tokens (migration 0011). Realtime rides `map:<mapId>`:
 * `token_move {id,x,y}` streams while a drag is in flight (throttled),
 * `token_upsert` / `token_remove` cover lifecycle. Postgres stays
 * authoritative — drags persist through the move_token RPC on pointer-up,
 * and everything else is plain owner-RLS writes. Hidden tokens are the GM's
 * prep layer: RLS keeps them out of player reads, so the broadcast helpers
 * below must never leak one (hiding broadcasts a remove; moves of hidden
 * tokens broadcast nothing).
 */

const MOVE_THROTTLE_MS = 30;

export function useMapTokens(mapId: string | null) {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [missing, setMissing] = useState(false);
  // Mirror for event handlers (drag callbacks fire outside the render cycle).
  const tokensRef = useRef<TokenRow[]>([]);
  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const throttle = useRef<{ timer: ReturnType<typeof setTimeout> | null; pending: { id: string; x: number; y: number } | null }>({
    timer: null,
    pending: null,
  });

  useEffect(() => {
    if (!mapId) return;
    let cancelled = false;
    const sb = supabase();
    sb.from("tokens")
      .select("*")
      .eq("map_id", mapId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setMissing(true);
          return;
        }
        setTokens((data as TokenRow[]) ?? []);
      });
    const ch = sb
      .channel(`map:${mapId}`)
      .on("broadcast", { event: "token_move" }, ({ payload }) => {
        const { id, x, y } = payload as { id: string; x: number; y: number };
        setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, x, y } : t)));
      })
      .on("broadcast", { event: "token_upsert" }, ({ payload }) => {
        const row = payload as TokenRow;
        setTokens((prev) =>
          prev.some((t) => t.id === row.id) ? prev.map((t) => (t.id === row.id ? row : t)) : [...prev, row],
        );
      })
      .on("broadcast", { event: "token_remove" }, ({ payload }) => {
        const { id } = payload as { id: string };
        setTokens((prev) => prev.filter((t) => t.id !== id));
      })
      .subscribe();
    channelRef.current = ch;
    const th = throttle.current;
    return () => {
      cancelled = true;
      if (th.timer) clearTimeout(th.timer);
      th.timer = null;
      th.pending = null;
      sb.removeChannel(ch);
      channelRef.current = null;
    };
  }, [mapId]);

  const send = useCallback((event: string, payload: unknown) => {
    channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  /** Optimistic local move + throttled broadcast; call every pointer-move. */
  const dragMove = useCallback(
    (id: string, x: number, y: number) => {
      setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, x, y } : t)));
      const hidden = tokensRef.current.find((t) => t.id === id)?.hidden;
      if (hidden) return; // GM shuffling prep pieces — players don't have them
      const th = throttle.current;
      th.pending = { id, x, y };
      if (!th.timer) {
        th.timer = setTimeout(() => {
          th.timer = null;
          if (th.pending) send("token_move", th.pending);
          th.pending = null;
        }, MOVE_THROTTLE_MS);
      }
    },
    [send],
  );

  /** Final position: flush the broadcast and persist via the RPC. */
  const dragEnd = useCallback(
    async (id: string, x: number, y: number) => {
      setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, x, y } : t)));
      const th = throttle.current;
      if (th.timer) clearTimeout(th.timer);
      th.timer = null;
      th.pending = null;
      if (!tokensRef.current.find((t) => t.id === id)?.hidden) send("token_move", { id, x, y });
      await supabase().rpc("move_token", { p_token: id, p_x: x, p_y: y });
    },
    [send],
  );

  const addToken = useCallback(
    async (fields: Omit<Partial<TokenRow>, "id" | "created_at"> & { map_id: string; owner_id: string }) => {
      const { data, error } = await supabase().from("tokens").insert(fields).select("*").single();
      if (error) {
        setMissing(true);
        return;
      }
      const row = data as TokenRow;
      setTokens((prev) => [...prev, row]);
      if (!row.hidden) send("token_upsert", row);
    },
    [send],
  );

  const patchToken = useCallback(
    async (id: string, patch: Partial<TokenRow>) => {
      const before = tokensRef.current.find((t) => t.id === id);
      if (!before) return;
      const row = { ...before, ...patch };
      setTokens((prev) => prev.map((t) => (t.id === id ? row : t)));
      await supabase().from("tokens").update(patch).eq("id", id);
      if (row.hidden) {
        if (!before.hidden) send("token_remove", { id }); // just vanished from the table
      } else {
        send("token_upsert", row);
      }
    },
    [send],
  );

  const deleteToken = useCallback(
    async (id: string) => {
      setTokens((prev) => prev.filter((t) => t.id !== id));
      await supabase().from("tokens").delete().eq("id", id);
      send("token_remove", { id });
    },
    [send],
  );

  return { tokens, missing, dragMove, dragEnd, addToken, patchToken, deleteToken };
}

function tokenInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

function Token({
  token,
  grid,
  snap,
  movable,
  gm,
  asset,
  onDrag,
  onDragEnd,
}: {
  token: TokenRow;
  grid: MapGrid;
  snap: boolean;
  movable: boolean;
  gm: boolean;
  asset: AssetRow | undefined;
  onDrag: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}) {
  const stage = useContext(StageTransformContext);
  const [hover, setHover] = useState(false);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const size = Math.max(4, token.size_squares * grid.pxPerSquare);
  const half = size / 2;
  const ringColor = token.hidden ? "#f59e0b" : token.character_id ? "#38bdf8" : "#52525b";

  function placed(e: React.PointerEvent): [number, number] {
    const d = drag.current!;
    const k = stage?.k ?? 1;
    const x = d.origX + (e.clientX - d.startX) / k;
    const y = d.origY + (e.clientY - d.startY) / k;
    return snap ? [snapHalf(x, grid.offsetX, grid.pxPerSquare), snapHalf(y, grid.offsetY, grid.pxPerSquare)] : [x, y];
  }

  function onPointerDown(e: React.PointerEvent<SVGGElement>) {
    if (!movable || e.button !== 0) return;
    e.stopPropagation();
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origX: token.x, origY: token.y };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture is best-effort (synthetic events have no active pointer)
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGGElement>) {
    if (drag.current?.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const [x, y] = placed(e);
    onDrag(token.id, x, y);
  }

  function onPointerUp(e: React.PointerEvent<SVGGElement>) {
    if (drag.current?.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const [x, y] = placed(e);
    drag.current = null;
    onDragEnd(token.id, x, y);
  }

  const labelWidth = Math.max(size, token.name.length * size * 0.11 + size * 0.2);

  return (
    <g
      transform={`translate(${token.x} ${token.y})`}
      opacity={token.hidden ? 0.45 : 1}
      style={{ cursor: movable ? "move" : "default" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-token-id={token.id}
    >
      <title>{token.name}</title>
      {asset ? (
        <image
          href={assetUrl(asset.storage_path)}
          x={-half}
          y={-half}
          width={size}
          height={size}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <>
          <circle r={half * 0.92} fill="#27272a" />
          <text textAnchor="middle" dominantBaseline="central" fontSize={half * 0.75} fill="#e4e4e7" fontFamily="var(--font-display), sans-serif">
            {tokenInitials(token.name)}
          </text>
        </>
      )}
      <circle
        r={half * 0.98}
        fill="none"
        stroke={ringColor}
        strokeWidth={Math.max(1, size / 40)}
        strokeDasharray={token.hidden ? `${size / 10} ${size / 14}` : undefined}
      />
      {token.hidden && gm && (
        <text x={half * 0.7} y={-half * 0.7} fontSize={half * 0.5} textAnchor="middle">
          👁
        </text>
      )}
      {hover && (
        <g pointerEvents="none">
          <rect x={-labelWidth / 2} y={-half - size * 0.34} width={labelWidth} height={size * 0.26} rx={size * 0.05} fill="rgba(9,9,11,0.88)" stroke="rgba(245,158,11,0.5)" strokeWidth={size / 120} />
          <text x={0} y={-half - size * 0.21} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.16} fill="#fcd34d" fontFamily="var(--font-display), sans-serif">
            {token.name}
          </text>
        </g>
      )}
    </g>
  );
}

/** All tokens on the map, z-ordered, rendered inside MapStage's map-coords slot. */
export function TokenLayer({
  tokens,
  grid,
  snap,
  gm = false,
  canMove,
  assets,
  onDrag,
  onDragEnd,
}: {
  tokens: TokenRow[];
  grid: MapGrid;
  snap: boolean;
  gm?: boolean;
  canMove: (t: TokenRow) => boolean;
  assets: Record<string, AssetRow>;
  onDrag: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}) {
  const sorted = [...tokens].sort((a, b) => a.z - b.z || a.created_at.localeCompare(b.created_at));
  return (
    <>
      {sorted.map((t) => (
        <Token
          key={t.id}
          token={t}
          grid={grid}
          snap={snap}
          movable={canMove(t)}
          gm={gm}
          asset={t.asset_id ? assets[t.asset_id] : undefined}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
        />
      ))}
    </>
  );
}

/**
 * GM's table for one map: the live stage (tokens draggable) plus per-token
 * controls — size, hide/show, link to a crawler, z-order, delete. Sits in
 * MapManager's expanded map editor.
 */
export function MapTokensPanel({
  map,
  backgroundAsset,
  assets,
  party,
}: {
  map: MapRow;
  backgroundAsset: AssetRow | undefined;
  assets: Record<string, AssetRow>;
  party: { id: string; name: string }[];
}) {
  const { user } = useUser();
  const { tokens, missing, dragMove, dragEnd, addToken, patchToken, deleteToken } = useMapTokens(map.id);
  const { strokes, remoteLive, progress, commit, removeStroke, clearAll } = useMapDrawings(map);
  const [snap, setSnap] = useState(true);
  const [picker, setPicker] = useState(false);
  const [tool, setTool] = useState<"move" | "pen" | "erase">("move");
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0]);
  const [thick, setThick] = useState(false);

  function placeFromAsset(asset: AssetRow) {
    setPicker(false);
    if (!user) return;
    const g = map.grid;
    addToken({
      map_id: map.id,
      owner_id: user.id,
      name: asset.name,
      asset_id: asset.id,
      x: snapHalf((backgroundAsset?.width ?? 1000) / 2, g.offsetX, g.pxPerSquare),
      y: snapHalf((backgroundAsset?.height ?? 1000) / 2, g.offsetY, g.pxPerSquare),
    });
  }

  const mapW = backgroundAsset?.width ?? 1000;
  const mapH = backgroundAsset?.height ?? 1000;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(
          [
            ["move", "🖱 move", "Pan the map, drag tokens"],
            ["pen", "✏ draw", "Freehand sketch on the map (the party watches live)"],
            ["erase", "◻ erase", "Click a stroke to remove it"],
          ] as const
        ).map(([key, label, title]) => (
          <button
            key={key}
            onClick={() => setTool(key)}
            title={title}
            className={`rounded border px-2 py-1 ${
              tool === key ? "border-amber-600 bg-zinc-800 text-amber-300" : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-amber-600"
            }`}
          >
            {label}
          </button>
        ))}
        {tool === "pen" && (
          <>
            <span className="flex items-center gap-1">
              {PEN_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setPenColor(c)}
                  title={c}
                  className={`h-5 w-5 rounded-full border-2 ${penColor === c ? "border-white" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
            <button
              onClick={() => setThick(!thick)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300 hover:border-amber-600"
              title="Toggle line width"
            >
              {thick ? "━ thick" : "─ thin"}
            </button>
          </>
        )}
        {strokes.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm("Clear every drawing on this map?")) clearAll();
            }}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-400 hover:border-red-700 hover:text-red-300"
          >
            🧹 clear drawings
          </button>
        )}
      </div>

      {backgroundAsset ? (
        <MapStage
          imageUrl={assetUrl(backgroundAsset.storage_path)}
          width={mapW}
          height={mapH}
          grid={map.grid}
          className="h-80 w-full rounded border border-zinc-800"
        >
          <DrawingLayer strokes={strokes} live={[remoteLive]} erase={tool === "erase"} onErase={removeStroke} />
          <TokenLayer
            tokens={tokens}
            grid={map.grid}
            snap={snap}
            gm
            canMove={() => tool === "move"}
            assets={assets}
            onDrag={dragMove}
            onDragEnd={dragEnd}
          />
          {tool === "pen" && (
            <DrawingCapture
              width={mapW}
              height={mapH}
              color={penColor}
              strokeWidth={penStrokeWidth(map.grid.pxPerSquare, thick)}
              onProgress={progress}
              onCommit={commit}
            />
          )}
        </MapStage>
      ) : (
        <div className="flex h-40 w-full items-center justify-center rounded border border-zinc-800 bg-zinc-950 text-xs text-zinc-600">
          Background image missing (asset deleted?)
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button onClick={() => setPicker(true)} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">
          + Token from image
        </button>
        <label className="flex items-center gap-1 text-zinc-300">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          snap to grid
        </label>
        {missing && <span className="text-amber-400">Run migration 0011 to enable tokens.</span>}
      </div>

      {tokens.length > 0 && (
        <ul className="space-y-1">
          {[...tokens]
            .sort((a, b) => b.z - a.z || a.created_at.localeCompare(b.created_at))
            .map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs">
                <input
                  value={t.name}
                  onChange={(e) => patchToken(t.id, { name: e.target.value })}
                  className="w-32 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-zinc-200"
                />
                <label className="flex items-center gap-1 text-zinc-400">
                  size
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={t.size_squares}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n) && n > 0) patchToken(t.id, { size_squares: n });
                    }}
                    className="w-14 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-zinc-200"
                  />
                </label>
                <select
                  value={t.character_id ?? ""}
                  onChange={(e) => patchToken(t.id, { character_id: e.target.value || null })}
                  className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-zinc-300"
                  title="Link to a crawler — that player can drag this token"
                >
                  <option value="">no crawler</option>
                  {party.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => patchToken(t.id, { hidden: !t.hidden })}
                  className={`rounded px-1.5 py-0.5 ${t.hidden ? "bg-amber-900/60 text-amber-300" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                  title={t.hidden ? "Hidden from the party — click to reveal" : "Visible — click to hide (GM prep layer)"}
                >
                  {t.hidden ? "👁 hidden" : "👁 visible"}
                </button>
                <span className="ml-auto flex items-center gap-1">
                  <button onClick={() => patchToken(t.id, { z: t.z + 1 })} className="rounded bg-zinc-800 px-1 hover:bg-zinc-700" title="Bring forward">
                    ↑
                  </button>
                  <button onClick={() => patchToken(t.id, { z: t.z - 1 })} className="rounded bg-zinc-800 px-1 hover:bg-zinc-700" title="Send back">
                    ↓
                  </button>
                  <button onClick={() => deleteToken(t.id)} className="rounded px-1 text-zinc-600 hover:text-red-400" title="Remove token">
                    ✕
                  </button>
                </span>
              </li>
            ))}
        </ul>
      )}

      {picker && (
        <AssetPicker
          campaignId={map.campaign_id}
          kinds={["token", "misc"]}
          title="Token image"
          onPick={placeFromAsset}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  );
}

/**
 * Player center-stage view of the campaign's active map: fetches the map row,
 * every asset it needs (background + token images), and renders the pan/zoom
 * stage with live tokens. `characterId` unlocks dragging the token linked to
 * this crawler; everything else is read-only. The GM flipping the active map
 * is heard over `map_state` by the sheet, which just swaps `mapId` here.
 */
export function ActiveMapStage({ mapId, characterId }: { mapId: string; characterId?: string }) {
  // Keyed remount resets the fetch state whenever the GM switches maps.
  return <ActiveMapStageInner key={mapId} mapId={mapId} characterId={characterId} />;
}

function ActiveMapStageInner({ mapId, characterId }: { mapId: string; characterId?: string }) {
  const [map, setMap] = useState<MapRow | null>(null);
  const [assets, setAssets] = useState<Record<string, AssetRow>>({});
  const [failed, setFailed] = useState(false);
  const fetchedAssetIds = useRef<Set<string>>(new Set());
  const { tokens, dragMove, dragEnd } = useMapTokens(mapId);
  const { strokes, remoteLive } = useMapDrawings(map);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: mapRow } = await supabase().from("maps").select("*").eq("id", mapId).maybeSingle();
      if (cancelled) return;
      if (!mapRow) setFailed(true);
      else setMap(mapRow as MapRow);
    })();
    return () => {
      cancelled = true;
    };
  }, [mapId]);

  // Fetch background + token images as they appear (tokens arrive over
  // realtime too, so this tops up rather than loading once).
  useEffect(() => {
    const wanted = new Set<string>();
    if (map?.asset_id) wanted.add(map.asset_id);
    for (const t of tokens) if (t.asset_id) wanted.add(t.asset_id);
    const ids = [...wanted].filter((id) => !fetchedAssetIds.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => fetchedAssetIds.current.add(id));
    supabase()
      .from("assets")
      .select("*")
      .in("id", ids)
      .then(({ data }) => {
        const rows = (data as AssetRow[]) ?? [];
        if (rows.length > 0) setAssets((prev) => ({ ...prev, ...Object.fromEntries(rows.map((a) => [a.id, a])) }));
      });
  }, [map, tokens]);

  const bg = map?.asset_id ? assets[map.asset_id] : undefined;

  return (
    <section className="overflow-hidden rounded-lg border border-emerald-900 bg-zinc-950">
      <div className="flex items-baseline gap-2 border-b border-emerald-900/50 px-3 py-1">
        <span className="font-display text-[10px] tracking-[0.3em] text-emerald-400">▚ TACTICAL MAP ▞</span>
        {map && <span className="truncate text-[10px] text-zinc-500">{map.name}</span>}
        <span className="ml-auto text-[9px] text-zinc-600">drag to pan · scroll to zoom</span>
      </div>
      {failed ? (
        <p className="px-3 py-6 text-center text-xs text-zinc-600">
          Map feed unavailable — it may have been deleted, or you are not in this campaign.
        </p>
      ) : map ? (
        <MapStage
          imageUrl={bg ? assetUrl(bg.storage_path) : null}
          width={bg?.width ?? 1000}
          height={bg?.height ?? 1000}
          grid={map.grid}
          className="h-[65vh] w-full"
        >
          <DrawingLayer strokes={strokes} live={[remoteLive]} />
          <TokenLayer
            tokens={tokens}
            grid={map.grid}
            snap
            canMove={(t) => !!characterId && t.character_id === characterId}
            assets={assets}
            onDrag={dragMove}
            onDragEnd={dragEnd}
          />
        </MapStage>
      ) : (
        <p className="px-3 py-6 text-center text-xs text-zinc-600">Establishing map feed…</p>
      )}
    </section>
  );
}
