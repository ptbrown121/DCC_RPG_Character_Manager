"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { assetUrl } from "@/lib/upload";
import { fitTransform, pan, zoomAt, type StageTransform } from "@/lib/stage";
import type { AssetRow, MapGrid, MapRow } from "@/lib/types";

const ZOOM_BTN =
  "h-7 w-7 rounded border border-zinc-700 bg-zinc-950/80 text-sm text-zinc-300 hover:border-amber-600 hover:text-amber-300";

/** SVG grid lines for a map background — used by the GM preview and the stage. */
export function MapGridLines({ grid, width, height, idSuffix }: { grid: MapGrid; width: number; height: number; idSuffix: string }) {
  if (!grid.show || grid.pxPerSquare <= 0) return null;
  const patternId = `map-grid-${idSuffix}`;
  return (
    <>
      <defs>
        <pattern
          id={patternId}
          width={grid.pxPerSquare}
          height={grid.pxPerSquare}
          x={grid.offsetX}
          y={grid.offsetY}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${grid.pxPerSquare} 0 L 0 0 0 ${grid.pxPerSquare}`}
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={Math.max(1, width / 1200)}
          />
        </pattern>
      </defs>
      <rect width={width} height={height} fill={`url(#${patternId})`} pointerEvents="none" />
    </>
  );
}

/**
 * The tabletop: one SVG with a pan/zoomable <g>. Drag empty space to pan,
 * wheel to zoom (anchored on the cursor, clamped around the fit scale),
 * double-click or ⤢ to re-fit. `children` render inside the transformed
 * group in map (image-pixel) coordinates — the drawing/AoE/token layers
 * (T6/T7/T12) plug in there, above the image and grid.
 */
export function MapStage({
  imageUrl,
  width,
  height,
  grid,
  children,
  className = "",
}: {
  imageUrl: string | null;
  /** Map image size in px — the map coordinate space. */
  width: number;
  height: number;
  grid: MapGrid;
  children?: React.ReactNode;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<{ w: number; h: number } | null>(null);
  const [t, setT] = useState<StageTransform | null>(null);
  // Fit scale for the current view — zoom clamps are relative to it.
  const fitK = useRef(1);
  // Once the user pans/zooms, container resizes stop re-fitting under them.
  const touched = useRef(false);
  const drag = useRef<{ pointerId: number; lastX: number; lastY: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setView({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const refit = useCallback(() => {
    if (!view || width <= 0) return;
    const fit = fitTransform(width, height, view.w, view.h);
    fitK.current = fit.k;
    touched.current = false;
    setT(fit);
  }, [view, width, height]);

  // Fit on first measure, on map change, and on resize while untouched.
  useEffect(() => {
    if (!view) return;
    if (!touched.current) {
      refit();
    } else {
      fitK.current = fitTransform(width, height, view.w, view.h).k;
    }
  }, [view, width, height, refit]);

  // React registers wheel listeners passively, so preventDefault (needed to
  // stop the page scrolling) requires a native non-passive listener.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      touched.current = true;
      setT((prev) =>
        prev
          ? zoomAt(prev, e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015), fitK.current)
          : prev,
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function zoomButtons(factor: number) {
    if (!view) return;
    touched.current = true;
    setT((prev) => (prev ? zoomAt(prev, view.w / 2, view.h / 2, factor, fitK.current) : prev));
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0 && e.button !== 1) return;
    drag.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.lastX;
    const dy = e.clientY - d.lastY;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    if (dx || dy) {
      touched.current = true;
      setT((prev) => (prev ? pan(prev, dx, dy) : prev));
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId === e.pointerId) drag.current = null;
  }

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden bg-zinc-950 ${className}`}
      style={{ touchAction: "none" }}
    >
      <svg
        width="100%"
        height="100%"
        className="cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={refit}
      >
        {t && (
          <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`} data-stage-transform={`${t.x},${t.y},${t.k}`}>
            {imageUrl ? (
              <image href={imageUrl} width={width} height={height} />
            ) : (
              <rect width={width || 100} height={height || 100} fill="#18181b" />
            )}
            <MapGridLines grid={grid} width={width} height={height} idSuffix={uid} />
            {children}
          </g>
        )}
      </svg>
      <div className="absolute bottom-2 right-2 flex gap-1">
        <button onClick={() => zoomButtons(1 / 1.4)} title="Zoom out" className={ZOOM_BTN}>−</button>
        <button onClick={refit} title="Fit map to view (or double-click)" className={ZOOM_BTN}>⤢</button>
        <button onClick={() => zoomButtons(1.4)} title="Zoom in" className={ZOOM_BTN}>+</button>
      </div>
    </div>
  );
}

/**
 * Player center-stage view of the campaign's active map: fetches the map row
 * (+ its background asset) and renders the pan/zoom stage in the Area-feed
 * slot. Members can read maps via RLS; the GM flipping the active map is
 * heard over `map_state` by the sheet, which just swaps `mapId` here.
 */
export function ActiveMapStage({ mapId }: { mapId: string }) {
  // Keyed remount resets the fetch state whenever the GM switches maps.
  return <ActiveMapStageInner key={mapId} mapId={mapId} />;
}

function ActiveMapStageInner({ mapId }: { mapId: string }) {
  const [map, setMap] = useState<MapRow | null>(null);
  const [asset, setAsset] = useState<AssetRow | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: mapRow } = await supabase().from("maps").select("*").eq("id", mapId).maybeSingle();
      if (cancelled) return;
      if (!mapRow) {
        setFailed(true);
        return;
      }
      const m = mapRow as MapRow;
      setMap(m);
      if (m.asset_id) {
        const { data: assetRow } = await supabase().from("assets").select("*").eq("id", m.asset_id).maybeSingle();
        if (!cancelled) setAsset((assetRow as AssetRow) ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapId]);

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
          imageUrl={asset ? assetUrl(asset.storage_path) : null}
          width={asset?.width ?? 1000}
          height={asset?.height ?? 1000}
          grid={map.grid}
          className="h-[65vh] w-full"
        />
      ) : (
        <p className="px-3 py-6 text-center text-xs text-zinc-600">Establishing map feed…</p>
      )}
    </section>
  );
}
