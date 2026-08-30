"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import HbTracker from "@/components/HbTracker";
import { supabase } from "@/lib/supabase";
import {
  DUNGEON_DAY_HOURS,
  formatDungeonTime,
  hoursRemaining,
  STAT_KEYS,
  STAT_LABELS,
  statMod,
  deriveFromEnhanced,
  slotsLostToDamage,
  mitigateDamage,
  opposedDifficulty,
  unopposedDifficulty,
  statCheckDifficulty,
  REST_RULES,
  DEBUFFS,
  applyItemEffect,
  describeItemEffect,
  reconcileDebuffRows,
  roundDown,
  RANK_CAP_EARLY,
  RANK_CAP_ABSOLUTE,
  SAFE_GRIND_HOURS_PER_DAY,
  grindCheckReady,
  grindLevelReady,
  type StatKey,
  type CatalogSkill,
  type CatalogSpell,
} from "@/lib/rules";
import { SkillSelect, SpellSelect } from "@/components/CatalogSelect";
import RaceClassPanel from "@/components/RaceClassPanel";
import FameFaithPanel from "@/components/FameFaithPanel";
import { LootPanel, CompanionsPanel } from "@/components/AssetsPanels";
import {
  HudBars,
  HudRail,
  Hotlist,
  Minimap,
  NotificationsHud,
  SceneStage,
  SystemOverlay,
  useSystemSends,
  type HudElement,
  type HudNotification,
  type SystemSend,
} from "@/components/Hud";
import { ActiveMapStage, type BombDrop } from "@/components/Tokens";
import { InventoryItems, useInventory, type InventoryEntry } from "@/components/Items";
import { Hotbar, HotbarDnd, ItemDrag, SpellDrag } from "@/components/Hotbar";
import { clearSlot, findEntry, firstFreeSlot, placeEntry, seedHotbar } from "@/lib/hotbar";
import type { HotbarEntry } from "@/lib/types";
import type { Campaign, CampaignFloor, Character, SceneState, SkillRow, SpellRow } from "@/lib/types";

/** Post-consume System commentary, keyed by effect kind. */
const CONSUME_SNARK: Record<string, string> = {
  heal_slots: " The System notes your cowardice.",
  restore_mana: " Try not to waste it.",
  cure_debuff: " Hygiene achievement progress: 1%.",
};

function Sheet() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Character | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [damageIn, setDamageIn] = useState("");
  const [drIn, setDrIn] = useState("0");
  const [debuffPick, setDebuffPick] = useState(DEBUFFS[0].name);
  const [rollLog, setRollLog] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [notifications, setNotifications] = useState<HudNotification[]>([
    { kind: "system", text: "Welcome, Crawler. Try not to die today.", at: 0 },
  ]);
  const [overlay, setOverlay] = useState<SystemSend | null>(null);
  const [activeFloor, setActiveFloor] = useState<CampaignFloor | null>(null);

  const notify = useCallback((kind: HudNotification["kind"], text: string) => {
    setNotifications((prev) => [...prev, { kind, text, at: Date.now() }]);
  }, []);

  useEffect(() => {
    supabase()
      .from("characters")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => setC(data as Character));
    supabase()
      .from("campaigns")
      .select("*")
      .then(({ data }) => setCampaigns((data as Campaign[]) ?? []));
  }, [id]);

  // Collapse countdown for the linked campaign's active floor.
  const campaignId = c?.campaign_id ?? null;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const floor = campaignId
        ? ((
            await supabase()
              .from("campaign_floors")
              .select("*")
              .eq("campaign_id", campaignId)
              .eq("status", "active")
              .limit(1)
          ).data?.[0] as CampaignFloor | undefined) ?? null
        : null;
      if (!cancelled) setActiveFloor(floor);
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const [hudHidden, setHudHidden] = useState<HudElement[]>([]);
  // "play" clears the bookkeeping away for table time; "manage" is the full editable sheet.
  const [mode, setMode] = useState<"play" | "manage">("play");
  // Live Area-feed updates override the persisted one fetched with the campaign.
  const [liveScene, setLiveScene] = useState<SceneState | null>(null);
  // Live active-map switches likewise override campaigns.active_map_id
  // (undefined = no broadcast heard yet, fall back to the row).
  const [liveMapId, setLiveMapId] = useState<string | null | undefined>(undefined);
  // Bumped when the GM grants an item so an open inventory panel refetches.
  const [invRefresh, setInvRefresh] = useState(0);
  const inv = useInventory(id, invRefresh);
  // A cure-anything consumable waiting for the player to pick a debuff.
  const [curePick, setCurePick] = useState<InventoryEntry | null>(null);
  // Registered by the tactical map: converts a hotbar bomb drop into a marker.
  const bombDropRef = useRef<BombDrop | null>(null);
  useSystemSends(id, c?.campaign_id ?? null, {
    onSend: (send) => {
      setOverlay(send);
      notify("system", send.text || "The AI shows you something.");
    },
    // GM switching HUD elements off (interviews, or the AI being "funny").
    onConfig: (config) => setHudHidden(config.hidden),
    onScene: (scene) => {
      setLiveScene(scene);
      notify("floor", scene.imageUrl || scene.caption ? "Area feed updated." : "Area feed cleared.");
    },
    onMapState: ({ activeMapId }) => {
      setLiveMapId(activeMapId);
      notify("floor", activeMapId ? "Tactical map online." : "Tactical map feed closed.");
    },
    onItemGrant: () => setInvRefresh((k) => k + 1),
  });

  const derived = useMemo(() => (c ? deriveFromEnhanced(c.stats.enhanced, c.move_ft) : null), [c]);

  const persist = useCallback(async (patch: Partial<Character>) => {
    setC((prev) => (prev ? ({ ...prev, ...patch } as Character) : prev));
    setSaveState("saving");
    const { error } = await supabase()
      .from("characters")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaveState(error ? "error" : "saved");
  }, [id]);

  if (!c || !derived) return <p className="text-zinc-400">Loading…</p>;

  const { mods, hbSlotValue, maxMana } = derived;

  function applyDamage() {
    if (!c) return;
    const raw = Number(damageIn);
    if (!raw || raw <= 0) return;
    const afterDr = mitigateDamage(raw, { dr: Number(drIn) || 0 });
    const lost = slotsLostToDamage(afterDr, hbSlotValue);
    const remaining = Math.max(0, c.current_hb_slots - lost);
    persist({ current_hb_slots: remaining });
    notify("crawler", `You took ${afterDr} damage (${lost} slot${lost === 1 ? "" : "s"}).`);
    if (remaining === 0) notify("system", "You are DYING. This is going to be great for ratings.");
    setDamageIn("");
  }

  function updateSkill(i: number, patch: Partial<SkillRow>) {
    if (!c) return;
    persist({ skills: c.skills.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  }

  const rankCap = c ? (c.floor >= 6 ? RANK_CAP_ABSOLUTE : RANK_CAP_EARLY) : RANK_CAP_EARLY;

  /** +1 grind hour on a skill; also ticks the daily and lifetime totals. */
  function grindHour(i: number) {
    if (!c) return;
    const grind = c.grind ?? { total: 0, today: 0 };
    persist({
      skills: c.skills.map((s, j) => (j === i ? { ...s, grind: (s.grind ?? 0) + 1 } : s)),
      grind: { total: grind.total + 1, today: grind.today + 1 },
    });
  }

  /** Advancement check for one skill: 1d20 ≥ current rank → +1 rank. Resets its grind hours. */
  function rollAdvancement(i: number, viaGrind: boolean) {
    if (!c) return;
    const s = c.skills[i];
    const d20 = 1 + Math.floor(Math.random() * 20);
    const passed = d20 >= s.rank && s.rank < rankCap;
    setRollLog(
      `${s.name}: rolled ${d20} vs Rank ${s.rank} — ${passed ? `Rank up! Now ${s.rank + 1}` : s.rank >= rankCap ? `at the Rank ${rankCap} cap` : "no change"}`,
    );
    if (passed) notify("crawler", `Skill level up! ${s.name} is now Rank ${s.rank + 1}.`);
    persist({
      skills: c.skills.map((row, j) =>
        j === i
          ? { ...row, rank: passed ? row.rank + 1 : row.rank, marked: viaGrind ? row.marked : false, grind: viaGrind ? 0 : row.grind }
          : row,
      ),
    });
  }

  /** Roll advancement for marked skills (2-hour block: rank ≤4 only; end of floor: all). */
  function rollMarked(maxRank: number) {
    if (!c) return;
    const results: string[] = [];
    const skills = c.skills.map((s) => {
      if (!s.marked || s.rank > maxRank) return s;
      const d20 = 1 + Math.floor(Math.random() * 20);
      const passed = d20 >= s.rank && s.rank < rankCap;
      results.push(`${s.name} ${d20}${passed ? "✓" : "✗"}`);
      if (passed) notify("crawler", `Skill level up! ${s.name} is now Rank ${s.rank + 1}.`);
      return { ...s, rank: passed ? s.rank + 1 : s.rank, marked: false };
    });
    setRollLog(results.length ? `Advancement: ${results.join(" · ")}` : "No eligible marked skills.");
    persist({ skills });
  }

  /** Spend mana on a spell (Heal also restores slots). Shared by the list and the Hotlist. */
  function castSpell(sp: SpellRow) {
    if (!c || c.current_mana < sp.mana) return;
    persist({
      current_mana: Math.max(0, c.current_mana - sp.mana),
      ...(sp.name === "Heal"
        ? { current_hb_slots: Math.min(10, c.current_hb_slots + REST_RULES.healSpellSlots) }
        : {}),
    });
    notify("crawler", `Cast ${sp.name} (−${sp.mana} Mana).`);
  }

  /** Click behavior for item slots: consumables consume (T11), bombs deploy in T12. */
  function useItemFromBar(entry: InventoryEntry) {
    const item = entry.item;
    if (!item) return;
    if (item.kind === "bomb") {
      notify("system", `${item.name}: deployment requires the tactical map. Patience, crawler.`);
    } else if (item.kind === "consumable") {
      consumeItem(entry);
    } else {
      notify("crawler", `${item.name}: ${describeItemEffect(item.effect)}`);
    }
  }

  function shortRest() {
    if (!c) return;
    persist({
      current_hb_slots: Math.min(10, c.current_hb_slots + REST_RULES.shortRestSlots),
      current_mana: Math.min(maxMana, c.current_mana + roundDown(maxMana / 2)),
    });
  }

  function longRest() {
    if (!c) return;
    persist({
      current_hb_slots: 10,
      current_mana: maxMana,
      debuffs: c.debuffs.filter((d) => d.name !== "Fatigued"),
    });
  }

  const collapseRemaining = activeFloor
    ? hoursRemaining(activeFloor.collapse_days, activeFloor.hours_elapsed)
    : null;
  const hotlisted = c.spells.filter((s) => s.hotlist);
  // Unified hotbar view (0013): seeded from hotlist flags while the stored bar
  // is empty; the seed persists with the first bar mutation (drag or ★). Null
  // until the migration ran → the old spells-only Hotlist stays as fallback.
  const bar = c.hotbar !== undefined ? seedHotbar(c.hotbar, c.spells) : null;

  /**
   * T11: click-to-consume. The engine does the math; this handles the confirm
   * (the debuff picker doubles as the confirm on the cure path), the qty
   * decrement with optimistic concurrency (row changed under us → refetch,
   * touch nothing), and hotbar cleanup when the last one is spent. Consuming
   * while Dying is deliberately allowed — that's what potions are for.
   */
  async function consumeItem(entry: InventoryEntry, chosenDebuff?: string) {
    const item = entry.item;
    if (!c || !item || item.kind !== "consumable") return;
    let effect = item.effect;
    if (effect?.kind === "cure_debuff" && !effect.debuffId && !chosenDebuff) {
      if (c.debuffs.length === 0) {
        notify("system", "No debuffs to cure. The System applauds your unearned good health.");
        return;
      }
      setCurePick(entry);
      return;
    }
    if (effect?.kind === "cure_debuff" && chosenDebuff) effect = { kind: "cure_debuff", debuffId: chosenDebuff };
    if (!chosenDebuff && !window.confirm(`Use ${item.name}?`)) return;

    const outcome = effect
      ? applyItemEffect(
          {
            hbSlots: c.current_hb_slots,
            maxHbSlots: 10,
            mana: c.current_mana,
            maxMana,
            debuffs: c.debuffs.map((d) => d.name),
          },
          effect,
        )
      : null;
    // A no-op outcome (already full, The Taint, nothing to cure) spares the
    // item; custom/effect-less consumables always spend — the text IS the effect.
    const consumed = !effect || effect.kind === "custom" || !!outcome?.changed;
    if (!consumed && outcome) {
      notify("system", `${outcome.summary} (${item.name} not consumed.)`);
      return;
    }

    if (!(await spendOne(entry))) return;

    if (outcome?.changed) {
      persist({
        current_hb_slots: outcome.target.hbSlots,
        current_mana: outcome.target.mana,
        debuffs: reconcileDebuffRows(c.debuffs, outcome.target.debuffs),
      });
    }
    notify(
      "crawler",
      `You used ${item.name}. ${outcome?.summary ?? "Nothing happens. Probably."}${CONSUME_SNARK[effect?.kind ?? ""] ?? ""}`,
    );
  }

  /**
   * Spend one of an inventory stack: qty −1 with optimistic concurrency (the
   * write is qualified on the qty we read — zero rows touched means another
   * tab moved first, so refetch and apply nothing). The last one deletes the
   * row and clears its hotbar slot. Shared by consumables and bomb throws.
   */
  async function spendOne(entry: InventoryEntry): Promise<boolean> {
    const item = entry.item;
    if (!item) return false;
    const q =
      entry.row.qty > 1
        ? supabase()
            .from("character_items")
            .update({ qty: entry.row.qty - 1 })
            .eq("id", entry.row.id)
            .eq("qty", entry.row.qty)
            .select("id")
        : supabase()
            .from("character_items")
            .delete()
            .eq("id", entry.row.id)
            .eq("qty", entry.row.qty)
            .select("id");
    const { data: touched } = await q;
    if (!touched?.length) {
      notify("system", "Inventory desync detected. Recounting your possessions.");
      setInvRefresh((k) => k + 1);
      return false;
    }
    if (entry.row.qty === 1 && bar) {
      const at = findEntry(bar, { type: "item", id: item.id });
      if (at >= 0) persist({ hotbar: clearSlot(bar, at) });
    }
    setInvRefresh((k) => k + 1);
    return true;
  }

  /** T12: an item dropped on the tactical map. Bombs blow up; the rest bounce. */
  async function handleMapDrop(itemId: string, sx: number, sy: number) {
    const entry = inv.entries?.find((en) => en.item?.id === itemId);
    const item = entry?.item;
    if (!entry || !item) return;
    if (item.kind !== "bomb") {
      notify("system", `${item.name} bounces off the map and returns to your pack.`);
      return;
    }
    const radiusFt = item.effect?.kind === "aoe" ? item.effect.radiusFt : 10;
    const note = item.effect?.kind === "aoe" ? item.effect.note : undefined;
    const status = (await bombDropRef.current?.(sx, sy, {
      radiusFt,
      label: item.name,
      note,
      assetId: item.asset_id,
    })) ?? "no-map";
    if (status !== "ok") {
      notify(
        "system",
        status === "migration"
          ? "Blast markers need migration 0014. The System apologizes for the inconvenience."
          : status === "out-of-bounds"
            ? `${item.name} sails past the edge of the map. Retrieved, barely.`
            : "No tactical map to deploy on.",
      );
      return;
    }
    if (await spendOne(entry)) {
      notify("crawler", `You deployed ${item.name} — ${radiusFt} ft blast zone marked. The System recommends running.`);
    }
  }

  return (
    <HotbarDnd bar={bar} onChange={(next) => persist({ hotbar: next })} onMapDrop={handleMapDrop}>
    <div className="space-y-6 pb-24 pt-12">
      {/* HUD chrome (book default layout: notifications ↖, bars ↗, hotlist ↓, minimap ↘).
          Elements the GM has switched off simply vanish, like the AI took them. */}
      {!hudHidden.includes("notifications") && <NotificationsHud items={notifications} />}
      {!hudHidden.includes("bars") && (
        <HudBars
          hbSlots={c.current_hb_slots}
          slotValue={hbSlotValue}
          mana={c.current_mana}
          maxMana={maxMana}
          collapseLabel={collapseRemaining != null ? formatDungeonTime(collapseRemaining) : null}
          collapseUrgent={collapseRemaining != null && collapseRemaining <= DUNGEON_DAY_HOURS}
        >
          <div className="space-y-2 text-xs">
            {c.current_hb_slots === 0 && (
              <p className="font-semibold text-red-400">DYING — countdown {mods.con} rounds.</p>
            )}
            <div className="flex items-center gap-1">
              <input
                type="number"
                placeholder="Damage"
                value={damageIn}
                onChange={(e) => setDamageIn(e.target.value)}
                className="w-20 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
              />
              <label className="text-zinc-400">
                DR{" "}
                <input
                  type="number"
                  value={drIn}
                  onChange={(e) => setDrIn(e.target.value)}
                  className="w-12 rounded border border-zinc-700 bg-zinc-800 px-1 py-1"
                />
              </label>
              <button onClick={applyDamage} className="rounded bg-red-600 px-2 py-1 font-semibold hover:bg-red-500">
                Hit
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              <button className="rounded bg-zinc-800 px-1.5 py-0.5" onClick={() => persist({ current_mana: Math.max(0, c.current_mana - 1) })}>−1 MP</button>
              <button className="rounded bg-zinc-800 px-1.5 py-0.5" onClick={() => persist({ current_mana: Math.min(maxMana, c.current_mana + 1) })}>+1 MP</button>
              <button className="rounded bg-emerald-800 px-1.5 py-0.5 hover:bg-emerald-700" onClick={() => persist({ current_hb_slots: Math.min(10, c.current_hb_slots + REST_RULES.healSpellSlots), current_mana: Math.max(0, c.current_mana - 2) })}>
                Heal
              </button>
              <button className="rounded bg-zinc-800 px-1.5 py-0.5 hover:bg-zinc-700" onClick={shortRest}>Short rest</button>
              <button className="rounded bg-zinc-800 px-1.5 py-0.5 hover:bg-zinc-700" onClick={longRest}>Long rest</button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {c.debuffs.map((d, i) => (
                <span key={`${d.name}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-red-900 bg-red-950 px-2 py-0.5 text-red-300">
                  {d.name}
                  <button onClick={() => persist({ debuffs: c.debuffs.filter((_, j) => j !== i) })} className="text-red-500 hover:text-white">✕</button>
                </span>
              ))}
              <select
                value={debuffPick}
                onChange={(e) => setDebuffPick(e.target.value)}
                className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5"
              >
                {DEBUFFS.map((d) => (
                  <option key={d.name} value={d.name} title={d.effect}>{d.name}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  const def = DEBUFFS.find((x) => x.name === debuffPick)!;
                  if (!def.stackable && c.debuffs.some((d) => d.name === debuffPick)) return;
                  persist({ debuffs: [...c.debuffs, { name: debuffPick }] });
                }}
                className="rounded bg-zinc-800 px-1.5 py-0.5 hover:bg-zinc-700"
              >
                +
              </button>
            </div>
          </div>
        </HudBars>
      )}
      {!hudHidden.includes("hotlist") &&
        (bar ? (
          <Hotbar
            bar={bar}
            spells={c.spells}
            inventory={inv.entries ?? []}
            mana={c.current_mana}
            onCast={castSpell}
            onUseItem={useItemFromBar}
          />
        ) : (
          <Hotlist spells={hotlisted} mana={c.current_mana} onCast={castSpell} />
        ))}
      {!hudHidden.includes("minimap") && (
        <Minimap floor={c.floor} label={campaigns.find((cp) => cp.id === c.campaign_id)?.name ?? null} />
      )}
      {overlay && <SystemOverlay send={overlay} onDismiss={() => setOverlay(null)} />}

      {/* Cure-anything consumable: pick which active debuff it burns (this IS the confirm). */}
      {curePick && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setCurePick(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-80 max-w-full rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-2xl"
          >
            <h3 className="mb-3 font-display font-semibold tracking-wider text-amber-300">
              {curePick.item?.name}: cure which debuff?
            </h3>
            <div className="flex flex-col gap-1">
              {[...new Set(c.debuffs.map((d) => d.name))].map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    const picked = curePick;
                    setCurePick(null);
                    consumeItem(picked, name);
                  }}
                  className="rounded border border-red-900 bg-red-950/60 px-3 py-1.5 text-left text-sm text-red-200 hover:border-red-500"
                >
                  {name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurePick(null)}
              className="mt-3 rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide">{c.name}</h1>
          <p className="text-sm text-zinc-400">
            Level {c.level} · Floor {c.floor} ·{" "}
            {[c.race, c.class].filter(Boolean).join(" ") || "no race/class yet (Floor 3 unlock)"}
          </p>
          {mode === "play" && (
            <p className="mt-1 font-mono text-xs text-zinc-500">
              {STAT_KEYS.map((k) => `${k.toUpperCase()} ${c.stats.enhanced[k]}(+${statMod(c.stats.enhanced[k])})`).join(" · ")}
              {` · Evade d20+${mods.dex} · Move ${c.move_ft} ft · AI Favor ${c.ai_favor}`}
            </p>
          )}
        </div>
        <span className="text-xs text-zinc-500">
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "⚠ Save failed" : saveState === "saved" ? "Saved" : ""}
        </span>
      </header>

      {/* Mode switch lives in the HUD corner, not the content column */}
      <button
        onClick={() => setMode(mode === "play" ? "manage" : "play")}
        className="hud-item fixed bottom-3 left-3 z-40 rounded border border-zinc-700 bg-zinc-950/90 px-3 py-1.5 font-display text-xs tracking-wider text-zinc-300 hover:border-amber-600"
        title={mode === "play" ? "Open the full editable sheet" : "Back to the combat view (bookkeeping hidden)"}
      >
        {mode === "play" ? "🛠 MANAGE SHEET" : "🎮 RETURN TO PLAY"}
      </button>

      {/* What the party is looking at (GM-controlled, persisted on the campaign):
          the tabletop map when one is active, otherwise the image Area feed. */}
      {(() => {
        const campaign = campaigns.find((cp) => cp.id === c.campaign_id);
        const activeMapId = liveMapId !== undefined ? liveMapId : (campaign?.active_map_id ?? null);
        return activeMapId ? (
          <ActiveMapStage mapId={activeMapId} characterId={c.id} bombDropRef={bombDropRef} />
        ) : (
          <SceneStage scene={liveScene ?? campaign?.scene ?? null} />
        );
      })()}

      {/* Play mode: side rail opens skills / spells / inventory / companions as
          floating panels, keeping the center clear for the Area feed. */}
      {mode === "play" && (
        <HudRail
          tabs={[
            {
              key: "skills",
              label: "🎲 SKILLS",
              content: (
                <ul className="space-y-1 text-sm">
                  {c.skills.map((s, i) => (
                    <li key={`${s.name}-${i}`} className="flex items-center justify-between gap-2">
                      <span>
                        {s.name}
                        <span className="ml-2 text-xs uppercase text-zinc-500">{s.stat ?? ""}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-emerald-400">
                          {s.check_type === "passive" ? "passive" : `d20 +${s.rank + (s.stat ? mods[s.stat as StatKey] : 0)}`}
                        </span>
                        <label className="flex items-center gap-1 text-xs text-zinc-500" title="Mark on any attempt">
                          <input type="checkbox" checked={s.marked} onChange={(e) => updateSkill(i, { marked: e.target.checked })} />
                        </label>
                      </span>
                    </li>
                  ))}
                  {c.skills.length === 0 && <li className="text-xs text-zinc-500">No skills yet — add them in Manage.</li>}
                </ul>
              ),
            },
            {
              key: "spells",
              label: "✨ SPELLS",
              content: (
                <ul className="space-y-1 text-sm">
                  {c.spells.map((sp, i) => {
                    const onBar = bar
                      ? findEntry(bar, { type: "spell", id: sp.name }) >= 0
                      : !!sp.hotlist;
                    return (
                    <li key={`${sp.name}-${i}`} className="flex items-center justify-between gap-2">
                      <SpellDrag spell={sp}>
                        <span>
                          {sp.name}
                          <span className="ml-2 text-xs text-zinc-500">R{sp.rank} · {sp.mana}mp · {sp.effect}</span>
                        </span>
                      </SpellDrag>
                      <span className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (bar) {
                              const entry: NonNullable<HotbarEntry> = { type: "spell", id: sp.name };
                              const at = findEntry(bar, entry);
                              if (at >= 0) persist({ hotbar: clearSlot(bar, at) });
                              else {
                                const free = firstFreeSlot(bar);
                                if (free >= 0) persist({ hotbar: placeEntry(bar, free, entry) });
                              }
                            } else {
                              if (!sp.hotlist && hotlisted.length >= 10) return;
                              persist({ spells: c.spells.map((s, j) => (j === i ? { ...s, hotlist: !s.hotlist } : s)) });
                            }
                          }}
                          className={onBar ? "text-amber-400" : "text-zinc-600 hover:text-amber-400"}
                          title={onBar ? "Remove from hotbar" : "Add to hotbar (or drag it onto a slot)"}
                        >
                          {onBar ? "★" : "☆"}
                        </button>
                        <button
                          disabled={c.current_mana < sp.mana}
                          onClick={() => castSpell(sp)}
                          className="rounded bg-indigo-700 px-2 py-0.5 text-xs font-semibold hover:bg-indigo-600 disabled:opacity-40"
                        >
                          Cast
                        </button>
                      </span>
                    </li>
                    );
                  })}
                  {c.spells.length === 0 && <li className="text-xs text-zinc-500">No spells known.</li>}
                </ul>
              ),
            },
            {
              key: "inventory",
              label: "🎒 INVENTORY",
              content: (
                <div className="space-y-2 text-sm">
                  <InventoryItems
                    entries={inv.entries}
                    missing={inv.missing}
                    DragWrap={ItemDrag}
                    onUse={(entry) => consumeItem(entry)}
                  />
                  <div className="flex items-center gap-3 border-t border-zinc-800 pt-2">
                    <span>
                      Gold <b className="font-display">{c.gold}</b>
                    </span>
                    <button className="rounded bg-zinc-800 px-2" onClick={() => persist({ gold: Math.max(0, c.gold - 1) })}>−</button>
                    <button className="rounded bg-zinc-800 px-2" onClick={() => persist({ gold: c.gold + 1 })}>+</button>
                    <span className="ml-2">
                      Junk <b className="font-display">{c.misc_junk}</b>
                    </span>
                    <button className="rounded bg-zinc-800 px-2" onClick={() => persist({ misc_junk: Math.max(0, c.misc_junk - 1) })}>−</button>
                    <button className="rounded bg-zinc-800 px-2" onClick={() => persist({ misc_junk: c.misc_junk + 1 })}>+</button>
                  </div>
                  <ul className="space-y-1 text-xs">
                    {c.loot.map((box, i) => (
                      <li key={i} className={box.opened ? "text-zinc-600 line-through" : "text-zinc-300"}>
                        {box.tier} {box.type}
                        {box.contents && <span className="text-zinc-500"> — {box.contents}</span>}
                      </li>
                    ))}
                    {c.loot.length === 0 && <li className="text-zinc-500">No loot boxes.</li>}
                  </ul>
                </div>
              ),
            },
            {
              key: "companions",
              label: "🐾 COMPANIONS",
              content: (
                <ul className="space-y-1 text-sm">
                  {c.companions.map((cp, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span>
                        {cp.name} <span className="text-xs text-zinc-500">{cp.kind} · {cp.species} · Lv {cp.level}</span>
                      </span>
                      <span className="font-mono text-xs text-emerald-400">HB {cp.current_slots}/{cp.hb_slots}</span>
                    </li>
                  ))}
                  {c.companions.length === 0 && <li className="text-xs text-zinc-500">No companions. Every crawler needs a Mongo.</li>}
                </ul>
              ),
            },
          ]}
        />
      )}

      {/* Stats */}
      {mode === "manage" && (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-3 font-semibold">Stats (Enhanced layer)</h2>
        <div className="grid grid-cols-5 gap-2">
          {STAT_KEYS.map((k) => (
            <div key={k} className="rounded border border-zinc-800 bg-zinc-950 p-2 text-center">
              <div className="text-xs uppercase text-zinc-500">{STAT_LABELS[k]}</div>
              <input
                type="number"
                min={0}
                value={c.stats.enhanced[k]}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value));
                  persist({ stats: { ...c.stats, enhanced: { ...c.stats.enhanced, [k]: v } } });
                }}
                className="mt-1 w-full bg-transparent text-center text-lg font-bold outline-none"
              />
              <div className="font-mono text-xs text-emerald-400">+{statMod(c.stats.enhanced[k])}</div>
              <div className="mt-1 text-[10px] text-zinc-600">
                unenh.{" "}
                <input
                  type="number"
                  min={0}
                  value={c.stats.unenhanced[k]}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value));
                    persist({ stats: { ...c.stats, unenhanced: { ...c.stats.unenhanced, [k]: v } } });
                  }}
                  className="w-10 bg-transparent text-center text-[10px] text-zinc-400 outline-none"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1 text-xs text-zinc-300 sm:grid-cols-4">
          <div>Evade: <b>d20 +{mods.dex}</b></div>
          <div>Lift: <b>{derived.liftLimitLbs} lbs</b></div>
          <div>Move: <b>{c.move_ft} ft</b> + 10 ft Step</div>
          <div>Dying countdown: <b>{mods.con}</b> rounds</div>
          <div>Opposed diff. vs you: <b>{opposedDifficulty(0, c.floor)}+Stat</b></div>
          <div>Unopposed (F{c.floor}): <b>{unopposedDifficulty(c.floor)}</b></div>
          <div>Stat Check (F{c.floor}): <b>{statCheckDifficulty(c.floor)}</b></div>
          <div>AI Favor:{" "}
            <button className="rounded bg-zinc-800 px-1" onClick={() => persist({ ai_favor: Math.max(0, c.ai_favor - 1) })}>−</button>{" "}
            <b>{c.ai_favor}</b>{" "}
            <button className="rounded bg-zinc-800 px-1" onClick={() => persist({ ai_favor: c.ai_favor + 1 })}>+</button>
          </div>
        </div>
      </section>
      )}

      {/* Race & Class */}
      {mode === "manage" && <RaceClassPanel character={c} onApply={(patch) => persist(patch)} />}

      {/* Health & Mana */}
      {mode === "manage" && (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-3 font-semibold">Health Bar</h2>
        <HbTracker
          slots={10}
          slotValue={hbSlotValue}
          current={c.current_hb_slots}
          onChange={(n) => persist({ current_hb_slots: n })}
        />
        {c.current_hb_slots === 0 && (
          <p className="mt-2 text-sm font-semibold text-red-400">
            DYING — countdown {mods.con} rounds; −1 per Clean Up and per damage instance. Heal to
            ≥10% (1 slot) to survive.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <input
            type="number"
            placeholder="Damage"
            value={damageIn}
            onChange={(e) => setDamageIn(e.target.value)}
            className="w-24 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          />
          <label className="text-xs text-zinc-400">
            DR{" "}
            <input
              type="number"
              value={drIn}
              onChange={(e) => setDrIn(e.target.value)}
              className="w-14 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
            />
          </label>
          <button onClick={applyDamage} className="rounded bg-red-600 px-3 py-1 font-semibold hover:bg-red-500">
            Apply damage
          </button>
          <span className="text-xs text-zinc-500">
            (damage below one slot&apos;s value ({hbSlotValue}) is lost)
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-400">
            Mana <b className="text-zinc-100">{c.current_mana}/{maxMana}</b>
          </span>
          <button className="rounded bg-zinc-800 px-2 py-1" onClick={() => persist({ current_mana: Math.max(0, c.current_mana - 1) })}>−1</button>
          <button className="rounded bg-zinc-800 px-2 py-1" onClick={() => persist({ current_mana: Math.min(maxMana, c.current_mana + 1) })}>+1</button>
          <span className="mx-2 text-zinc-700">|</span>
          <button onClick={() => persist({ current_hb_slots: Math.min(10, c.current_hb_slots + REST_RULES.healSpellSlots), current_mana: Math.max(0, c.current_mana - 2) })} className="rounded bg-emerald-700 px-2 py-1 hover:bg-emerald-600">
            Cast Heal (2 Mana → +2 slots)
          </button>
          <button onClick={shortRest} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">
            Short rest (+5 slots, +½ Mana)
          </button>
          <button onClick={longRest} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">
            Long rest (full, clear Fatigued)
          </button>
        </div>
      </section>
      )}

      {/* Debuffs */}
      {mode === "manage" && (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-3 font-semibold">Debuffs</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {c.debuffs.map((d, i) => {
            const def = DEBUFFS.find((x) => x.name === d.name);
            return (
              <span
                key={`${d.name}-${i}`}
                title={def ? `${def.effect} — ${def.duration}` : ""}
                className="inline-flex items-center gap-1 rounded-full border border-red-900 bg-red-950 px-3 py-1 text-xs text-red-300"
              >
                {d.name}
                <button onClick={() => persist({ debuffs: c.debuffs.filter((_, j) => j !== i) })} className="text-red-500 hover:text-white">✕</button>
              </span>
            );
          })}
          {c.debuffs.length === 0 && <span className="text-xs text-zinc-500">None. Lucky you.</span>}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <select value={debuffPick} onChange={(e) => setDebuffPick(e.target.value)} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1">
            {DEBUFFS.map((d) => (
              <option key={d.name} value={d.name} title={d.effect}>
                {d.name}{d.stackable ? " (stackable)" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              const def = DEBUFFS.find((x) => x.name === debuffPick)!;
              if (!def.stackable && c.debuffs.some((d) => d.name === debuffPick)) return;
              persist({ debuffs: [...c.debuffs, { name: debuffPick }] });
            }}
            className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700"
          >
            Add
          </button>
          <span className="text-xs text-zinc-500">
            {DEBUFFS.find((x) => x.name === debuffPick)?.effect} · {DEBUFFS.find((x) => x.name === debuffPick)?.duration}
          </span>
        </div>
      </section>
      )}

      {/* Skills */}
      {mode === "manage" && (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Skills</h2>
          <div className="flex flex-wrap items-center gap-2">
            <SkillSelect
              exclude={c.skills.map((s) => s.name)}
              onPick={(cs: CatalogSkill) =>
                persist({
                  skills: [
                    ...c.skills,
                    {
                      name: cs.name,
                      category: cs.category,
                      stat: cs.stat,
                      check_type: cs.checkType,
                      rank: 0,
                      marked: false,
                      notes: [cs.damage, cs.range, cs.effect].filter(Boolean).join(" · ") || undefined,
                    },
                  ],
                })
              }
            />
            <button
              onClick={() => persist({ skills: c.skills.map((s) => ({ ...s, marked: false })) })}
              className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
              title="After advancement checks, erase all marks"
            >
              Clear marks
            </button>
            <button
              onClick={() =>
                persist({
                  skills: [
                    ...c.skills,
                    { name: "New skill", category: "utility", stat: "int", check_type: "unopposed", rank: 0, marked: false },
                  ],
                })
              }
              className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
            >
              + Add
            </button>
          </div>
        </div>
        <p className="mb-2 text-xs text-zinc-500">
          Any attempt marks a skill. Advancement: 1d20 ≥ current rank → +1 rank (rank ≤4 every 2 h
          of play; rank ≥5 at end of floor). Rank cap {rankCap} on this floor.
        </p>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <button onClick={() => rollMarked(4)} className="rounded bg-indigo-800 px-2 py-1 hover:bg-indigo-700" title="Roll advancement for marked skills of rank ≤4">
            End 2-h block: roll marked (rank ≤4)
          </button>
          <button onClick={() => rollMarked(rankCap)} className="rounded bg-indigo-900 px-2 py-1 hover:bg-indigo-800" title="Roll advancement for all marked skills">
            End of floor: roll all marked
          </button>
          <span className="text-zinc-500">
            Grind today:{" "}
            <b className={(c.grind?.today ?? 0) > SAFE_GRIND_HOURS_PER_DAY ? "text-red-400" : "text-zinc-200"}>
              {c.grind?.today ?? 0}h
            </b>
            /{SAFE_GRIND_HOURS_PER_DAY} safe
            {(c.grind?.today ?? 0) > SAFE_GRIND_HOURS_PER_DAY && " — Endurance Check per extra hour or it's wasted + Fatigued"}
          </span>
          <button onClick={() => persist({ grind: { ...(c.grind ?? { total: 0 }), today: 0, total: c.grind?.total ?? 0 } })} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">
            New day
          </button>
          <span className="text-zinc-500">
            Grind total: <b className="text-zinc-200">{c.grind?.total ?? 0}h</b>/{c.level} to level
          </span>
          {grindLevelReady(c.grind?.total ?? 0, c.level) && (
            <button
              onClick={() => {
                persist({ level: c.level + 1, grind: { today: c.grind?.today ?? 0, total: 0 } });
                notify("crawler", `LEVEL UP! You are now level ${c.level + 1}.`);
              }}
              className="rounded bg-amber-500 px-2 py-1 font-semibold text-zinc-950 hover:bg-amber-400"
            >
              ⬆ Level up from grinding (+1, reset total)
            </button>
          )}
        </div>
        {rollLog && <p className="mb-2 rounded border border-indigo-900 bg-indigo-950/40 px-2 py-1 text-xs text-indigo-200">{rollLog}</p>}
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-zinc-500">
            <tr>
              <th className="py-1">Skill</th>
              <th>Stat</th>
              <th>Rank</th>
              <th>Check bonus</th>
              <th>Marked</th>
              <th>Grind</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {c.skills.map((s, i) => (
              <tr key={i} className="border-t border-zinc-800">
                <td className="py-1">
                  <input value={s.name} onChange={(e) => updateSkill(i, { name: e.target.value })} className="w-full bg-transparent outline-none" />
                </td>
                <td className="text-xs uppercase text-zinc-400">{s.stat ?? "—"}</td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={s.rank}
                    onChange={(e) => updateSkill(i, { rank: Number(e.target.value) })}
                    className="w-12 rounded border border-zinc-800 bg-zinc-950 px-1 text-center"
                  />
                </td>
                <td className="font-mono text-emerald-400">
                  {s.check_type === "passive"
                    ? "passive"
                    : `d20 +${s.rank + (s.stat ? mods[s.stat as StatKey] : 0)}`}
                </td>
                <td>
                  <input type="checkbox" checked={s.marked} onChange={(e) => updateSkill(i, { marked: e.target.checked })} />
                </td>
                <td className="whitespace-nowrap">
                  {s.rank >= 1 ? (
                    grindCheckReady(s.grind ?? 0, s.rank) ? (
                      <button
                        onClick={() => rollAdvancement(i, true)}
                        className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-950 hover:bg-amber-400"
                        title={`${s.grind}h accrued (needs ${s.rank}) — roll the advancement check`}
                      >
                        ⬆ roll!
                      </button>
                    ) : (
                      <button
                        onClick={() => grindHour(i)}
                        className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] hover:bg-zinc-700"
                        title={`Accrue 1 grind hour (${s.grind ?? 0}/${s.rank} toward the next check)`}
                      >
                        {s.grind ?? 0}/{s.rank}h +
                      </button>
                    )
                  ) : (
                    <span className="text-[10px] text-zinc-700">—</span>
                  )}
                </td>
                <td>
                  <button onClick={() => persist({ skills: c.skills.filter((_, j) => j !== i) })} className="text-zinc-600 hover:text-red-400">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      )}

      {/* Spells */}
      {mode === "manage" && (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Spells</h2>
          <SpellSelect
            exclude={c.spells.map((s) => s.name)}
            onPick={(sp: CatalogSpell) =>
              persist({
                spells: [
                  ...c.spells,
                  { name: sp.name, mana: sp.mana, range: sp.range, effect: sp.effect, rank: 1, notes: sp.type } as SpellRow,
                ],
              })
            }
          />
        </div>
        <p className="mb-2 text-xs text-zinc-500">
          Attack spells roll d20 + Rank + INT Mod vs. Evade and add INT to damage. Must be in the
          Hotlist (★) to cast in combat; can&apos;t be used untrained.
        </p>
        <ul className="space-y-1 text-sm">
          {c.spells.map((sp, i) => {
            const affordable = c.current_mana >= sp.mana;
            return (
              <li key={`${sp.name}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5">
                <span>
                  <b>{sp.name}</b>
                  <span className="ml-2 text-xs text-zinc-400">
                    Rank{" "}
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={sp.rank}
                      onChange={(e) =>
                        persist({ spells: c.spells.map((s, j) => (j === i ? { ...s, rank: Number(e.target.value) } : s)) })
                      }
                      className="w-10 rounded border border-zinc-800 bg-zinc-900 px-1 text-center"
                    />{" "}
                    · {sp.mana} Mana · {sp.range} · {sp.effect}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {sp.notes === "attack" && (
                    <span className="font-mono text-xs text-emerald-400">d20 +{sp.rank + mods.int}</span>
                  )}
                  <button
                    onClick={() => {
                      if (!sp.hotlist && hotlisted.length >= 10) return;
                      persist({ spells: c.spells.map((s, j) => (j === i ? { ...s, hotlist: !s.hotlist } : s)) });
                    }}
                    className={`text-sm ${sp.hotlist ? "text-amber-400" : "text-zinc-600 hover:text-amber-400"}`}
                    title={sp.hotlist ? "Remove from Hotlist" : hotlisted.length >= 10 ? "Hotlist full (10 slots)" : "Pin to Hotlist (required to cast in combat)"}
                  >
                    {sp.hotlist ? "★" : "☆"}
                  </button>
                  <button
                    disabled={!affordable}
                    onClick={() => castSpell(sp)}
                    className="rounded bg-indigo-700 px-2 py-0.5 text-xs font-semibold hover:bg-indigo-600 disabled:opacity-40"
                    title={affordable ? `Spend ${sp.mana} Mana` : "Not enough Mana"}
                  >
                    Cast
                  </button>
                  {sp.name !== "Heal" && (
                    <button
                      onClick={() => persist({ spells: c.spells.filter((_, j) => j !== i) })}
                      className="text-zinc-600 hover:text-red-400"
                    >
                      ✕
                    </button>
                  )}
                </span>
              </li>
            );
          })}
          {c.spells.length === 0 && <li className="text-xs text-zinc-500">No spells known.</li>}
        </ul>
      </section>
      )}

      {/* Fame & Faith */}
      {mode === "manage" && <FameFaithPanel character={c} onPatch={(patch) => persist(patch)} />}

      {/* Loot & Companions */}
      {mode === "manage" && <LootPanel character={c} onPatch={(patch) => persist(patch)} />}
      {mode === "manage" && <CompanionsPanel character={c} onPatch={(patch) => persist(patch)} />}

      {/* Wallet + notes */}
      {mode === "manage" && (
      <section className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["gold", "Gold"],
            ["misc_junk", "Misc. Junk"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
            <div className="text-xs uppercase text-zinc-500">{label}</div>
            <div className="mt-1 flex items-center gap-2">
              <button className="rounded bg-zinc-800 px-2" onClick={() => persist({ [key]: Math.max(0, c[key] - 1) } as Partial<Character>)}>−</button>
              <input
                type="number"
                value={c[key]}
                onChange={(e) => persist({ [key]: Math.max(0, Number(e.target.value)) } as Partial<Character>)}
                className="w-20 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-center"
              />
              <button className="rounded bg-zinc-800 px-2" onClick={() => persist({ [key]: c[key] + 1 } as Partial<Character>)}>+</button>
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
          <div className="text-xs uppercase text-zinc-500">Campaign</div>
          <select
            value={c.campaign_id ?? ""}
            onChange={(e) => persist({ campaign_id: e.target.value || null })}
            className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1"
          >
            <option value="">— none —</option>
            {campaigns.map((cp) => (
              <option key={cp.id} value={cp.id}>{cp.name}</option>
            ))}
          </select>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
          <div className="text-xs uppercase text-zinc-500">Level / Floor</div>
          <div className="mt-1 flex items-center gap-2">
            <input type="number" min={1} max={250} value={c.level} onChange={(e) => persist({ level: Number(e.target.value) })} className="w-16 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-center" />
            <span className="text-zinc-500">/</span>
            <input type="number" min={1} value={c.floor} onChange={(e) => persist({ floor: Number(e.target.value) })} className="w-16 rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-center" />
          </div>
        </div>
      </section>
      )}

      {mode === "manage" && (
      <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="mb-2 font-semibold">Notes</h2>
        <textarea
          value={c.notes ?? ""}
          onChange={(e) => setC({ ...c, notes: e.target.value })}
          onBlur={(e) => persist({ notes: e.target.value })}
          rows={4}
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
          placeholder="Past Trauma, Loose End, Regret, gear, achievements…"
        />
      </section>
      )}
    </div>
    </HotbarDnd>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <Sheet />
    </AuthGate>
  );
}
