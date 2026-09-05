"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { listen, privateChannel, topics } from "@/lib/realtime";
import { StageTransformContext } from "./MapStage";
import type { DrawingStroke, MapRow } from "@/lib/types";

/*
 * GM freehand drawing (T7). Strokes live in map (image-pixel) coordinates so
 * they scale with zoom, persisted to maps.drawings (migration 0010) with the
 * GM's owner-RLS write. Live sync rides broadcast channel `draw:<mapId>`
 * (separate topic from `map:<mapId>` so the two hooks never contend for one
 * channel instance): `draw_progress` streams the stroke-so-far while the pen
 * is down, `draw_commit` finalizes, `draw_remove` / `draw_clear` erase.
 * Players are render-only.
 */

export const PEN_COLORS = ["#f59e0b", "#ef4444", "#38bdf8", "#34d399", "#f4f4f5"] as const;

const PROGRESS_THROTTLE_MS = 60;

export function useMapDrawings(map: MapRow | null) {
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  /** A remote stroke mid-draw (players watch the GM sketch in real time). */
  const [remoteLive, setRemoteLive] = useState<DrawingStroke | null>(null);
  const strokesRef = useRef<DrawingStroke[]>([]);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const throttle = useRef<{ timer: ReturnType<typeof setTimeout> | null; pending: DrawingStroke | null }>({
    timer: null,
    pending: null,
  });
  // Seed from the row exactly once per map — later row objects from grid
  // edits carry stale drawings and must not clobber live state.
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    if (map && seededFor.current !== map.id) {
      seededFor.current = map.id;
      setStrokes(map.drawings ?? []);
    }
  }, [map]);

  const mapId = map?.id ?? null;
  useEffect(() => {
    if (!mapId) return;
    const sb = supabase();
    const ch = privateChannel(topics.draw(mapId))
      .on("broadcast", { event: "draw_progress" }, ({ payload }) => {
        setRemoteLive(payload as DrawingStroke);
      })
      .on("broadcast", { event: "draw_commit" }, ({ payload }) => {
        const stroke = payload as DrawingStroke;
        setStrokes((prev) =>
          prev.some((s) => s.id === stroke.id) ? prev.map((s) => (s.id === stroke.id ? stroke : s)) : [...prev, stroke],
        );
        setRemoteLive((live) => (live?.id === stroke.id ? null : live));
      })
      .on("broadcast", { event: "draw_remove" }, ({ payload }) => {
        const { id } = payload as { id: string };
        setStrokes((prev) => prev.filter((s) => s.id !== id));
      })
      .on("broadcast", { event: "draw_clear" }, () => {
        setStrokes([]);
        setRemoteLive(null);
      });
    listen(ch);
    channelRef.current = ch;
    const th = throttle.current;
    return () => {
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

  const persist = useCallback(
    async (drawings: DrawingStroke[]) => {
      if (mapId) await supabase().from("maps").update({ drawings }).eq("id", mapId);
    },
    [mapId],
  );

  /** GM, while the pen is down: throttled stroke-so-far broadcast. */
  const progress = useCallback(
    (stroke: DrawingStroke) => {
      const th = throttle.current;
      th.pending = stroke;
      if (!th.timer) {
        th.timer = setTimeout(() => {
          th.timer = null;
          if (th.pending) send("draw_progress", th.pending);
          th.pending = null;
        }, PROGRESS_THROTTLE_MS);
      }
    },
    [send],
  );

  /** GM, on pen-up: append, persist, tell the table. */
  const commit = useCallback(
    async (stroke: DrawingStroke) => {
      const th = throttle.current;
      if (th.timer) clearTimeout(th.timer);
      th.timer = null;
      th.pending = null;
      const next = [...strokesRef.current, stroke];
      setStrokes(next);
      send("draw_commit", stroke);
      await persist(next);
    },
    [send, persist],
  );

  const removeStroke = useCallback(
    async (id: string) => {
      const next = strokesRef.current.filter((s) => s.id !== id);
      setStrokes(next);
      send("draw_remove", { id });
      await persist(next);
    },
    [send, persist],
  );

  const clearAll = useCallback(async () => {
    setStrokes([]);
    send("draw_clear", {});
    await persist([]);
  }, [send, persist]);

  return { strokes, remoteLive, progress, commit, removeStroke, clearAll };
}

function strokePath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    // A dot: draw a zero-length segment so round linecaps render it.
    const [x, y] = points[0];
    return `M ${x} ${y} L ${x + 0.01} ${y}`;
  }
  return `M ${points[0][0]} ${points[0][1]} ` + points.slice(1).map(([x, y]) => `L ${x} ${y}`).join(" ");
}

/** Committed strokes + any in-flight ones. In erase mode strokes grow a fat
 * invisible hit path and delete on click; otherwise the layer is inert. */
export function DrawingLayer({
  strokes,
  live,
  erase = false,
  onErase,
}: {
  strokes: DrawingStroke[];
  live?: (DrawingStroke | null)[];
  erase?: boolean;
  onErase?: (id: string) => void;
}) {
  const t = useContext(StageTransformContext);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hitWidth = (w: number) => Math.max(w * 2, 14 / (t?.k ?? 1));
  return (
    <g pointerEvents={erase ? "auto" : "none"}>
      {strokes.map((s) => (
        <g key={s.id}>
          <path
            d={strokePath(s.points)}
            fill="none"
            stroke={erase && hoverId === s.id ? "#fda4af" : s.color}
            strokeWidth={erase && hoverId === s.id ? s.width * 1.6 : s.width}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={erase && hoverId === s.id ? 0.9 : 1}
          />
          {erase && (
            <path
              d={strokePath(s.points)}
              fill="none"
              stroke="transparent"
              strokeWidth={hitWidth(s.width)}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoverId(s.id)}
              onMouseLeave={() => setHoverId((h) => (h === s.id ? null : h))}
              onPointerDown={(e) => {
                e.stopPropagation();
                onErase?.(s.id);
              }}
            />
          )}
        </g>
      ))}
      {(live ?? []).map(
        (s) =>
          s && (
            <path
              key={`live-${s.id}`}
              d={strokePath(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          ),
      )}
    </g>
  );
}

/**
 * GM pen surface: a transparent full-map rect above the other layers that
 * swallows pointer events while the pen tool is active. Points are captured
 * in map coordinates (so the sketch sticks to the map at any zoom), thinned
 * to ~2 screen px, streamed via onProgress and handed over on pen-up.
 */
export function DrawingCapture({
  width,
  height,
  color,
  strokeWidth,
  onProgress,
  onCommit,
}: {
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  onProgress: (stroke: DrawingStroke) => void;
  onCommit: (stroke: DrawingStroke) => void;
}) {
  const t = useContext(StageTransformContext);
  const [draft, setDraft] = useState<DrawingStroke | null>(null);
  const draftRef = useRef<DrawingStroke | null>(null);
  const pointer = useRef<number | null>(null);

  function toMap(e: React.PointerEvent<SVGRectElement>): [number, number] | null {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg || !t) return null;
    const r = svg.getBoundingClientRect();
    return [(e.clientX - r.left - t.x) / t.k, (e.clientY - r.top - t.y) / t.k];
  }

  function onPointerDown(e: React.PointerEvent<SVGRectElement>) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const pt = toMap(e);
    if (!pt) return;
    const stroke: DrawingStroke = { id: crypto.randomUUID(), color, width: strokeWidth, points: [pt] };
    pointer.current = e.pointerId;
    draftRef.current = stroke;
    setDraft(stroke);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture is best-effort (synthetic events have no active pointer)
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGRectElement>) {
    if (pointer.current !== e.pointerId || !draftRef.current || !t) return;
    e.stopPropagation();
    const pt = toMap(e);
    if (!pt) return;
    const pts = draftRef.current.points;
    const [lx, ly] = pts[pts.length - 1];
    // thin to ~2 screen px so strokes stay light
    if (Math.hypot((pt[0] - lx) * t.k, (pt[1] - ly) * t.k) < 2) return;
    const next = { ...draftRef.current, points: [...pts, pt] };
    draftRef.current = next;
    setDraft(next);
    onProgress(next);
  }

  function onPointerUp(e: React.PointerEvent<SVGRectElement>) {
    if (pointer.current !== e.pointerId || !draftRef.current) return;
    e.stopPropagation();
    const stroke = draftRef.current;
    pointer.current = null;
    draftRef.current = null;
    setDraft(null);
    onCommit(stroke);
  }

  return (
    <>
      {draft && <DrawingLayer strokes={[]} live={[draft]} />}
      <rect
        width={width}
        height={height}
        fill="transparent"
        style={{ cursor: "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </>
  );
}
