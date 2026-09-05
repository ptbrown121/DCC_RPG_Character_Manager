import { describe, expect, it } from "vitest";
import { topics } from "./realtimeTopics";

// Mirror of the grammar `realtime_topic_access()` parses in migration 0016.
// If a builder here changes shape, the SQL (and the harness) must change too.
const ID = "11111111-2222-4333-8444-555555555555";

describe("realtime topics", () => {
  it("builds the exact shapes the SQL policy parses", () => {
    expect(topics.campaignHud(ID)).toBe(`hud:campaign:${ID}`);
    expect(topics.characterHud(ID)).toBe(`hud:character:${ID}`);
    expect(topics.map(ID)).toBe(`map:${ID}`);
    expect(topics.moves(ID)).toBe(`moves:${ID}`);
    expect(topics.draw(ID)).toBe(`draw:${ID}`);
    expect(topics.mapMeta(ID)).toBe(`mapmeta:${ID}`);
    expect(topics.ping(ID)).toBe(`ping:${ID}`);
    expect(topics.aoe(ID)).toBe(`aoe:${ID}`);
  });

  it("uses only the prefixes the policy knows", () => {
    const prefixes = Object.values(topics).map((b) => b(ID).split(":").slice(0, -1).join(":"));
    expect(new Set(prefixes)).toEqual(
      new Set(["hud:campaign", "hud:character", "map", "moves", "draw", "mapmeta", "ping", "aoe"]),
    );
  });
});
