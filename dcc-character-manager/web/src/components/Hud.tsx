"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { assetUrl } from "@/lib/upload";
import { AssetPicker } from "./AssetLibrary";
import type { SceneState, SpellRow } from "@/lib/types";

/*
 * In-fiction HUD chrome for the character sheet, laid out per the book's default:
 * notifications folder top-left, health bar top-right with mana beneath and the
 * floor-collapse countdown under that, Hotlist (10 slots) bottom-center, minimap
 * bottom-right. Elements idle dimmed and sharpen on hover/focus (`.hud-item`) so
 * mousing around feels like the crawler glancing at their interface.
 */

export interface HudNotification {
  kind: "crawler" | "system" | "floor";
  text: string;
  at: number;
}

/** Payload the GM broadcasts to player HUDs (whole party or one crawler). */
export interface SystemSend {
  text: string;
  imageUrl?: string;
}

export const HUD_ELEMENTS = ["notifications", "bars", "hotlist", "minimap"] as const;
export type HudElement = (typeof HUD_ELEMENTS)[number];

/** GM-pushed HUD state — the AI switching parts of the interface off (interviews, jokes). */
export interface HudConfig {
  hidden: HudElement[];
}

const KIND_STYLES: Record<HudNotification["kind"], string> = {
  crawler: "border-amber-800 text-amber-200",
  system: "border-violet-800 text-violet-200",
  floor: "border-sky-800 text-sky-200",
};

const KIND_LABELS: Record<HudNotification["kind"], string> = {
  crawler: "CRAWLER",
  system: "SYSTEM",
  floor: "FLOOR",
};

export function NotificationsHud({ items }: { items: HudNotification[] }) {
  const [open, setOpen] = useState(false);
  const [readCount, setReadCount] = useState(0);
  const unread = items.length - readCount;

  return (
    // Floats top-left on desktop only; on phones it flows in the page's top HUD
    // row. When the list is open it must paint over the HudRail below it (also
    // z-40, later in the DOM) or the rail buttons sit on top of the messages.
    <div className={`hud-item lg:fixed lg:left-3 lg:top-16 ${open ? "z-[45]" : "z-40"}`}>
      <button
        onClick={() => {
          setOpen(!open);
          setReadCount(items.length);
        }}
        className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-950/90 px-3 py-1.5 font-display text-xs tracking-wider text-zinc-300 hover:border-amber-600"
      >
        🗂<span className="hidden sm:inline">NOTIFICATIONS</span>
        {unread > 0 && (
          <span className="animate-hud-blink inline-block h-2 w-2 rounded-full bg-amber-400" />
        )}
      </button>
      {open && (
        <ul className="animate-hud-materialize mt-1 max-h-72 w-80 max-w-[calc(100vw-1.5rem)] space-y-1 overflow-y-auto rounded border border-zinc-800 bg-zinc-950/95 p-2">
          {[...items].reverse().map((n, i) => (
            <li key={`${n.at}-${i}`} className={`rounded border-l-2 bg-zinc-900/80 px-2 py-1 text-xs ${KIND_STYLES[n.kind]}`}>
              <span className="mr-1 font-display text-[9px] tracking-wider opacity-60">{KIND_LABELS[n.kind]}</span>
              {n.text}
            </li>
          ))}
          {items.length === 0 && <li className="px-2 py-1 text-xs text-zinc-500">No notifications. Suspicious.</li>}
        </ul>
      )}
    </div>
  );
}

export function HudBars({
  hbSlots,
  slotValue,
  mana,
  maxMana,
  collapseLabel,
  collapseUrgent,
  children,
}: {
  hbSlots: number;
  slotValue: number;
  mana: number;
  maxMana: number;
  collapseLabel: string | null;
  collapseUrgent: boolean;
  /** Compact combat controls revealed when the crawler focuses on their bars. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hpColor = hbSlots <= 3 ? "bg-red-500" : hbSlots <= 5 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div
      className={`hud-item z-40 min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-950/90 p-2 lg:fixed lg:right-3 lg:top-16 lg:flex-none ${open ? "lg:w-80" : "lg:w-60"}`}
    >
      <button
        type="button"
        onClick={() => children && setOpen(!open)}
        className="block w-full space-y-1 text-left"
        title={children ? (open ? "Close" : "Focus on your bars to interact") : undefined}
      >
        <div className="flex items-center gap-1" title={`${hbSlots * slotValue} HP (${hbSlots}/10 slots × ${slotValue})`}>
          <span className="w-8 font-display text-[10px] tracking-wider text-zinc-400">HP</span>
          <div className="grid flex-1 grid-cols-10 gap-px">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className={`h-2.5 first:rounded-l last:rounded-r ${i < hbSlots ? hpColor : "bg-zinc-800"}`} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1" title={`${mana}/${maxMana} Mana`}>
          <span className="w-8 font-display text-[10px] tracking-wider text-zinc-400">MP</span>
          <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-800">
            <div className="h-full rounded bg-sky-500" style={{ width: maxMana > 0 ? `${(mana / maxMana) * 100}%` : "0%" }} />
          </div>
        </div>
        <div className={`pt-0.5 text-right font-display text-[10px] tracking-wider ${collapseUrgent ? "animate-hud-blink text-red-400" : "text-zinc-400"}`}>
          {collapseLabel ? <>⏳ COLLAPSE {collapseLabel}</> : <span className="text-zinc-600">NO FLOOR TIMER</span>}
        </div>
      </button>
      {open && children && (
        <div className="animate-hud-materialize mt-2 border-t border-zinc-800 pt-2">{children}</div>
      )}
    </div>
  );
}

export function Hotlist({
  spells,
  mana,
  onCast,
}: {
  spells: SpellRow[];
  mana: number;
  onCast: (sp: SpellRow) => void;
}) {
  const slots: (SpellRow | null)[] = Array.from({ length: 10 }, (_, i) => spells[i] ?? null);
  return (
    <div className="hud-item fixed bottom-3 left-1/2 z-40 grid -translate-x-1/2 grid-cols-5 gap-1 sm:flex">
      {slots.map((sp, i) => (
        <button
          key={i}
          disabled={!sp || mana < sp.mana}
          onClick={() => sp && onCast(sp)}
          title={sp ? `${sp.name} — ${sp.mana} Mana${mana < sp.mana ? " (not enough Mana)" : ""}` : `Empty slot ${(i + 1) % 10}`}
          className={`relative h-12 w-12 rounded border text-[9px] leading-tight ${
            sp
              ? "border-indigo-700 bg-indigo-950/90 text-indigo-100 hover:border-indigo-400 disabled:opacity-40"
              : "border-zinc-800 bg-zinc-950/70"
          }`}
        >
          <span className="absolute left-0.5 top-0 text-[8px] text-zinc-600">{(i + 1) % 10}</span>
          {sp && (
            <>
              <span className="block overflow-hidden px-0.5 pt-1">{sp.name}</span>
              <span className="block text-sky-400">{sp.mana}mp</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

export function Minimap({ floor, label }: { floor: number; label: string | null }) {
  return (
    <div className="hud-item fixed bottom-3 right-3 z-40 hidden lg:block">
      <div className="relative h-24 w-24 overflow-hidden rounded-full border border-zinc-700 bg-zinc-950/90">
        <div
          className="animate-radar-sweep absolute inset-0"
          style={{ background: "conic-gradient(rgba(16,185,129,0.25), transparent 60deg, transparent)" }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-lg font-bold text-emerald-400">F{floor}</span>
          {label && <span className="max-w-20 truncate text-center text-[9px] text-zinc-400">{label}</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * Vertical rail of HUD tabs on the left edge (play mode): skills, spells,
 * inventory, companions… Selecting one opens a floating panel beside the rail,
 * keeping the center of the screen clear for the Area feed.
 */
export function HudRail({
  tabs,
}: {
  tabs: { key: string; label: string; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState<string | null>(null);
  const current = tabs.find((t) => t.key === active);
  return (
    <>
      {/* Vertical rail in the desktop gutter; horizontal tab row in flow on phones. */}
      <div className="hud-item z-40 flex flex-wrap gap-1 lg:fixed lg:left-3 lg:top-28 lg:flex-col">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(active === t.key ? null : t.key)}
            className={`rounded border px-3 py-1.5 text-left font-display text-xs tracking-wider ${
              active === t.key
                ? "border-amber-600 bg-zinc-900 text-amber-300"
                : "border-zinc-700 bg-zinc-950/90 text-zinc-300 hover:border-amber-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {current && (
        <div className="animate-hud-materialize z-40 max-h-[60vh] overflow-y-auto rounded border border-zinc-800 bg-zinc-950/95 p-3 lg:fixed lg:left-40 lg:top-28 lg:max-h-[70vh] lg:w-[26rem] lg:max-w-[75vw]">
          {current.content}
        </div>
      )}
    </>
  );
}

/** Persistent center-stage display: the map or monster the party is looking at. */
export function SceneStage({ scene }: { scene: SceneState | null }) {
  if (!scene || (!scene.imageUrl && !scene.caption)) return null;
  return (
    <section className="overflow-hidden rounded-lg border border-emerald-900 bg-zinc-950">
      <div className="border-b border-emerald-900/50 px-3 py-1 font-display text-[10px] tracking-[0.3em] text-emerald-400">
        ▚ AREA FEED ▞
      </div>
      {scene.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary GM-supplied URL, can't allowlist domains for next/image
        <img src={scene.imageUrl} alt="" className="max-h-[65vh] w-full object-contain" />
      )}
      {scene.caption && <p className="px-3 py-2 text-sm italic text-zinc-300">{scene.caption}</p>}
    </section>
  );
}

/** Full-screen System message overlay — the AI directing your attention to something. */
export function SystemOverlay({ send, onDismiss }: { send: SystemSend; onDismiss: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
      onClick={onDismiss}
    >
      <div className="animate-hud-materialize max-w-2xl rounded-lg border-2 border-amber-500/70 bg-zinc-950 p-5 shadow-[0_0_60px_rgba(245,158,11,0.25)]">
        <div className="mb-3 font-display text-xs tracking-[0.3em] text-amber-400">
          ▚ SYSTEM MESSAGE ▞
        </div>
        {send.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary GM-supplied URL, can't allowlist domains for next/image
          <img src={send.imageUrl} alt="" className="mb-3 max-h-[60vh] w-full rounded object-contain" />
        )}
        {send.text && <p className="text-lg italic text-zinc-100">{send.text}</p>}
        <p className="mt-3 text-right text-xs text-zinc-500">tap anywhere to dismiss</p>
      </div>
    </div>
  );
}

/**
 * Subscribe this crawler's HUD to GM sends. Party-wide sends arrive on
 * `hud:campaign:<id>`; private sends on `hud:character:<id>` (filtering is
 * client-side convenience for a table of friends, not a security boundary).
 */
/**
 * GM-side sender: push a System message/image to every open sheet in the party,
 * or privately to one crawler (rewards, secrets, sponsor offers). Sends are
 * ephemeral — a sheet must be open to receive one.
 */
export function GmSendPanel({
  campaignId,
  party,
  scene,
  onSceneChange,
}: {
  campaignId: string;
  party: { id: string; name: string }[];
  /** Current persisted Area feed (campaigns.scene). */
  scene?: SceneState | null;
  /** Persist a new Area feed; the panel handles the live broadcast itself. */
  onSceneChange?: (scene: SceneState) => void;
}) {
  const [target, setTarget] = useState("all");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sceneUrl, setSceneUrl] = useState(scene?.imageUrl ?? "");
  const [sceneCaption, setSceneCaption] = useState(scene?.caption ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [hidden, setHidden] = useState<HudElement[]>([]);
  // Which field the asset library is picking an image for.
  const [picker, setPicker] = useState<"send" | "scene" | null>(null);
  const channels = useRef<Map<string, RealtimeChannel>>(new Map());

  useEffect(() => {
    const map = channels.current;
    return () => {
      map.forEach((ch) => supabase().removeChannel(ch));
      map.clear();
    };
  }, []);

  async function channelFor(name: string): Promise<RealtimeChannel> {
    let ch = channels.current.get(name);
    if (!ch) {
      const created = supabase().channel(name);
      channels.current.set(name, created);
      await new Promise<void>((resolve) =>
        created.subscribe((s) => {
          if (s === "SUBSCRIBED") resolve();
        }),
      );
      ch = created;
    }
    return ch;
  }

  function targetChannel(): Promise<RealtimeChannel> {
    return channelFor(target === "all" ? `hud:campaign:${campaignId}` : `hud:character:${target}`);
  }

  /** Area feed is always party-wide and persisted, unlike transient System sends. */
  async function setScene(next: SceneState) {
    onSceneChange?.(next);
    await (await channelFor(`hud:campaign:${campaignId}`)).send({
      type: "broadcast",
      event: "scene",
      payload: next,
    });
    setStatus(next.imageUrl || next.caption ? "Area feed updated on every open sheet." : "Area feed cleared.");
  }

  const targetLabel =
    target === "all" ? "the party" : (party.find((p) => p.id === target)?.name ?? "crawler");

  async function send() {
    if (!text.trim() && !imageUrl.trim()) return;
    const payload: SystemSend = { text: text.trim(), imageUrl: imageUrl.trim() || undefined };
    await (await targetChannel()).send({ type: "broadcast", event: "system_send", payload });
    setStatus(target === "all" ? "Broadcast to every open sheet in the party." : `Sent privately to ${targetLabel}.`);
    setText("");
    setImageUrl("");
  }

  async function applyHud() {
    const payload: HudConfig = { hidden };
    await (await targetChannel()).send({ type: "broadcast", event: "hud_config", payload });
    setStatus(
      hidden.length === 0
        ? `HUD fully restored for ${targetLabel}.`
        : `Switched off ${hidden.join(", ")} for ${targetLabel}.`,
    );
  }

  return (
    <section className="rounded-lg border border-violet-900 bg-zinc-900 p-4">
      <h2 className="mb-1 font-display font-semibold tracking-wider text-violet-300">
        ▚ SYSTEM SEND ▞
      </h2>
      <p className="mb-3 text-xs text-zinc-400">
        Appears center-screen on player HUDs — a message, a reward, or an image (“look at the
        monster”). Private sends are seen only by that crawler. Sheets must be open to receive.
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
        >
          <option value="all">📢 Whole party</option>
          {party.map((p) => (
            <option key={p.id} value={p.id}>🔒 {p.name} only</option>
          ))}
        </select>
        <input
          placeholder="Message (the AI's voice…)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-w-56 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
        />
        <input
          placeholder="Image URL (optional)"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-56 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
        />
        <button
          onClick={() => setPicker("send")}
          className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700"
          title="Pick from the asset library"
        >
          📁
        </button>
        <button
          onClick={send}
          className="rounded bg-violet-700 px-3 py-1 font-semibold hover:bg-violet-600"
        >
          Send
        </button>
      </div>
      {onSceneChange && (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <p className="mb-2 text-xs text-zinc-400">
            <b className="text-emerald-400">Area feed</b> — persistent map/monster image shown
            center-stage on every party sheet (saved to the campaign, so it survives reloads):
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              placeholder="Image URL (map, monster…)"
              value={sceneUrl}
              onChange={(e) => setSceneUrl(e.target.value)}
              className="min-w-56 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
            />
            <button
              onClick={() => setPicker("scene")}
              className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700"
              title="Pick from the asset library"
            >
              📁
            </button>
            <input
              placeholder="Caption"
              value={sceneCaption}
              onChange={(e) => setSceneCaption(e.target.value)}
              className="w-56 rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
            />
            <button
              onClick={() => setScene({ imageUrl: sceneUrl.trim() || undefined, caption: sceneCaption.trim() || undefined })}
              className="rounded bg-emerald-700 px-3 py-1 font-semibold hover:bg-emerald-600"
            >
              Display
            </button>
            <button
              onClick={() => {
                setSceneUrl("");
                setSceneCaption("");
                setScene({});
              }}
              className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-3 text-xs">
        <span className="text-zinc-400">HUD elements for {targetLabel}:</span>
        {HUD_ELEMENTS.map((el) => (
          <label key={el} className="flex items-center gap-1 text-zinc-300">
            <input
              type="checkbox"
              checked={!hidden.includes(el)}
              onChange={(e) =>
                setHidden((prev) => (e.target.checked ? prev.filter((h) => h !== el) : [...prev, el]))
              }
            />
            {el}
          </label>
        ))}
        <button
          onClick={applyHud}
          className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700"
          title="Switch HUD elements on/off on the target's screen — interviews, or the AI being “funny”"
        >
          Apply
        </button>
      </div>
      {status && <p className="mt-2 text-xs text-emerald-400">{status}</p>}
      {picker && (
        <AssetPicker
          campaignId={campaignId}
          title={picker === "send" ? "System send image" : "Area feed image"}
          onClose={() => setPicker(null)}
          onPick={(asset) => {
            const url = assetUrl(asset.storage_path);
            if (picker === "send") {
              setImageUrl(url);
            } else {
              setSceneUrl(url);
              if (!sceneCaption.trim()) setSceneCaption(asset.name);
            }
            setPicker(null);
          }}
        />
      )}
    </section>
  );
}

export function useSystemSends(
  characterId: string,
  campaignId: string | null,
  handlers: {
    onSend: (send: SystemSend) => void;
    onConfig: (config: HudConfig) => void;
    onScene: (scene: SceneState) => void;
    /** GM switched the active tabletop map (null = hidden again). */
    onMapState?: (state: { activeMapId: string | null }) => void;
    /** GM granted this crawler an item — refetch the inventory panel. */
    onItemGrant?: (grant: { itemId: string }) => void;
  },
) {
  const cb = useRef(handlers);
  useEffect(() => {
    cb.current = handlers;
  });
  useEffect(() => {
    const sb = supabase();
    const channels = [
      sb.channel(`hud:character:${characterId}`),
      ...(campaignId ? [sb.channel(`hud:campaign:${campaignId}`)] : []),
    ];
    for (const ch of channels) {
      ch.on("broadcast", { event: "system_send" }, ({ payload }) => cb.current.onSend(payload as SystemSend))
        .on("broadcast", { event: "hud_config" }, ({ payload }) => cb.current.onConfig(payload as HudConfig))
        .on("broadcast", { event: "scene" }, ({ payload }) => cb.current.onScene(payload as SceneState))
        .on("broadcast", { event: "map_state" }, ({ payload }) =>
          cb.current.onMapState?.(payload as { activeMapId: string | null }),
        )
        .on("broadcast", { event: "item_grant" }, ({ payload }) =>
          cb.current.onItemGrant?.(payload as { itemId: string }),
        )
        .subscribe();
    }
    return () => {
      channels.forEach((ch) => sb.removeChannel(ch));
    };
  }, [characterId, campaignId]);
}
