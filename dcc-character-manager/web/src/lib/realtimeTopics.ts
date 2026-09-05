/*
 * Topic grammar for the private Realtime channels. Pure (no client import)
 * so it can be unit-tested; keep it in lockstep with `realtime_topic_access()`
 * in supabase/migrations/0016_realtime_auth.sql — the harness asserts the
 * SQL side, realtimeTopics.test.ts asserts this side.
 */
export const topics = {
  /** Party-wide System sends, HUD config, Area feed, active-map switches. GM publishes. */
  campaignHud: (campaignId: string) => `hud:campaign:${campaignId}`,
  /** One crawler's private System sends / HUD config / item grants. GM publishes. */
  characterHud: (characterId: string) => `hud:character:${characterId}`,
  /** Token lifecycle (`token_upsert` / `token_remove`). GM publishes. */
  map: (mapId: string) => `map:${mapId}`,
  /** In-flight token drags (`token_move`). Anyone at the table publishes. */
  moves: (mapId: string) => `moves:${mapId}`,
  /** GM freehand drawing layer. GM publishes. */
  draw: (mapId: string) => `draw:${mapId}`,
  /** Grid/name recalibration (`map_patch`). GM publishes. */
  mapMeta: (mapId: string) => `mapmeta:${mapId}`,
  /** Shift+click "look HERE" flashes. Anyone at the table publishes. */
  ping: (mapId: string) => `ping:${mapId}`,
  /** Blast markers (`aoe_add` / `aoe_remove`). Anyone at the table publishes. */
  aoe: (mapId: string) => `aoe:${mapId}`,
} as const;
