// Pan/zoom math for the tabletop map stage. Pure functions so vitest can cover
// them; MapStage.tsx owns the DOM events and calls these. A transform maps
// map coordinates (image pixels) to screen coordinates within the stage:
// screen = map * k + (x, y).

export interface StageTransform {
  /** Screen-px translation of the map origin. */
  x: number;
  y: number;
  /** Scale: screen px per map px. */
  k: number;
}

/** Zoom clamps, relative to the fit-to-view scale. */
export const ZOOM_OUT_LIMIT = 0.5;
export const ZOOM_IN_LIMIT = 12;

/** Scale + center the map so it fits entirely inside the view. */
export function fitTransform(mapW: number, mapH: number, viewW: number, viewH: number): StageTransform {
  if (mapW <= 0 || mapH <= 0 || viewW <= 0 || viewH <= 0) return { x: 0, y: 0, k: 1 };
  const k = Math.min(viewW / mapW, viewH / mapH);
  return { x: (viewW - mapW * k) / 2, y: (viewH - mapH * k) / 2, k };
}

export function clampZoom(k: number, fitK: number): number {
  return Math.min(fitK * ZOOM_IN_LIMIT, Math.max(fitK * ZOOM_OUT_LIMIT, k));
}

/** Zoom by `factor`, keeping the map point under screen (cx, cy) fixed. */
export function zoomAt(t: StageTransform, cx: number, cy: number, factor: number, fitK: number): StageTransform {
  const k = clampZoom(t.k * factor, fitK);
  const ratio = k / t.k;
  return { k, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
}

export function pan(t: StageTransform, dx: number, dy: number): StageTransform {
  return { ...t, x: t.x + dx, y: t.y + dy };
}

/** Stage-local screen point → map coordinates (token drops, bomb throws). */
export function screenToMap(t: StageTransform, sx: number, sy: number): [number, number] {
  return [(sx - t.x) / t.k, (sy - t.y) / t.k];
}

export function mapToScreen(t: StageTransform, mx: number, my: number): [number, number] {
  return [mx * t.k + t.x, my * t.k + t.y];
}
