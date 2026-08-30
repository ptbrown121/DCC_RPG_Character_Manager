"use client";

/* eslint-disable @next/next/no-img-element -- storage-hosted user images, next/image adds nothing here */

import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { assetUrl } from "@/lib/upload";
import { useUser } from "./AuthGate";
import { AssetPicker } from "./AssetLibrary";
import {
  DEBUFF_NAMES,
  ITEM_KINDS,
  ITEM_RARITIES,
  describeItemEffect,
  type ItemEffect,
  type ItemKind,
  type ItemRarity,
} from "@/lib/rules";
import type { AssetRow, CharacterItemRow, ItemRow } from "@/lib/types";

/** Rarity color scale — shared by the catalog, tooltips (T9), and inventory. */
export const RARITY_COLORS: Record<ItemRarity, string> = {
  common: "#a1a1aa",
  uncommon: "#4ade80",
  rare: "#38bdf8",
  epic: "#c084fc",
  legendary: "#f59e0b",
  celestial: "#a5f3fc",
};

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  consumable: "🧪 Consumable",
  bomb: "💣 Bomb",
  equipment: "🛡 Equipment",
  quest: "📜 Quest",
  junk: "🗑 Junk",
};

/* ---------- Item tooltip (shared: inventory here, hotbar T10, map drops T12) ---------- */

// Assumed card size for edge flipping — a fixed estimate keeps this free of
// render-time DOM measuring; max-w/overflow on the card make it safe.
const TIP_W = 300;
const TIP_H = 200;

function tipPos(x: number, y: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    left: x + 14 + TIP_W > vw - 8 ? Math.max(8, x - 14 - TIP_W) : x + 14,
    top: y + 14 + TIP_H > vh - 8 ? Math.max(8, y - 14 - TIP_H) : y + 14,
  };
}

/** The HUD-styled item card itself; positioning is the wrapper's job. */
export function ItemTooltipCard({
  item,
  asset,
  pos,
}: {
  item: ItemRow;
  asset?: AssetRow | null;
  pos: { left: number; top: number };
}) {
  return (
    <div
      className="pointer-events-none fixed z-50 w-72 rounded-lg border bg-zinc-950/95 p-3 shadow-[0_0_30px_rgba(0,0,0,0.7)]"
      style={{ ...pos, borderColor: `${RARITY_COLORS[item.rarity]}66` }}
    >
      <div className="flex items-center gap-2">
        {asset && (
          <img
            src={assetUrl(asset.storage_path)}
            alt=""
            className="h-10 w-10 rounded border border-zinc-800 bg-zinc-900 object-contain"
          />
        )}
        <div>
          <p className="font-display font-semibold tracking-wide" style={{ color: RARITY_COLORS[item.rarity] }}>
            {item.name}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">
            {item.rarity} {item.kind}
            {item.stackable ? "" : " · does not stack"}
          </p>
        </div>
      </div>
      {item.description && <p className="mt-2 text-xs italic text-zinc-400">{item.description}</p>}
      <p className="mt-2 text-xs text-amber-300">{describeItemEffect(item.effect)}</p>
    </div>
  );
}

/**
 * Hover/focus wrapper: pointer-following tooltip, flipped near screen edges;
 * keyboard focus anchors it to the element instead.
 */
export function WithItemTooltip({
  item,
  asset,
  className,
  children,
}: {
  item: ItemRow;
  asset?: AssetRow | null;
  className?: string;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  return (
    <span
      tabIndex={0}
      className={className}
      onMouseEnter={(e) => setPos(tipPos(e.clientX, e.clientY))}
      onMouseMove={(e) => setPos(tipPos(e.clientX, e.clientY))}
      onMouseLeave={() => setPos(null)}
      onFocus={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos(tipPos(r.right, r.top));
      }}
      onBlur={() => setPos(null)}
    >
      {children}
      {pos && <ItemTooltipCard item={item} asset={asset} pos={pos} />}
    </span>
  );
}

/* ---------- GM item editor ---------- */

type EffectKind = ItemEffect["kind"] | "none";

/** Fresh defaults when the GM switches the effect type. */
function defaultEffect(kind: EffectKind): ItemEffect | null {
  switch (kind) {
    case "heal_slots":
      return { kind, slots: 2 };
    case "restore_mana":
      return { kind, amount: 5 };
    case "cure_debuff":
      return { kind };
    case "aoe":
      return { kind, radiusFt: 20, note: "" };
    case "custom":
      return { kind, text: "" };
    default:
      return null;
  }
}

const FIELD = "rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200";

function EffectBuilder({ effect, onChange }: { effect: ItemEffect | null; onChange: (e: ItemEffect | null) => void }) {
  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return (
    <div className="flex flex-wrap items-end gap-3 text-xs">
      <label className="flex flex-col gap-1 text-zinc-400">
        Effect
        <select
          value={effect?.kind ?? "none"}
          onChange={(e) => onChange(defaultEffect(e.target.value as EffectKind))}
          className={FIELD}
        >
          <option value="none">— none —</option>
          <option value="heal_slots">Heal HB slots</option>
          <option value="restore_mana">Restore Mana</option>
          <option value="cure_debuff">Cure debuff</option>
          <option value="aoe">Area of effect (bomb)</option>
          <option value="custom">Custom (GM adjudicates)</option>
        </select>
      </label>
      {effect?.kind === "heal_slots" && (
        <label className="flex flex-col gap-1 text-zinc-400">
          Slots
          <input
            type="number"
            min={1}
            value={effect.slots}
            onChange={(e) => onChange({ ...effect, slots: Math.max(1, num(e.target.value, 1)) })}
            className={`w-20 ${FIELD}`}
          />
        </label>
      )}
      {effect?.kind === "restore_mana" && (
        <label className="flex flex-col gap-1 text-zinc-400">
          Mana
          <input
            type="number"
            min={1}
            value={effect.amount}
            onChange={(e) => onChange({ ...effect, amount: Math.max(1, num(e.target.value, 1)) })}
            className={`w-20 ${FIELD}`}
          />
        </label>
      )}
      {effect?.kind === "cure_debuff" && (
        <label className="flex flex-col gap-1 text-zinc-400">
          Debuff
          <select
            value={effect.debuffId ?? ""}
            onChange={(e) => onChange({ kind: "cure_debuff", ...(e.target.value ? { debuffId: e.target.value } : {}) })}
            className={FIELD}
          >
            <option value="">Choose at use</option>
            {DEBUFF_NAMES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      )}
      {effect?.kind === "aoe" && (
        <>
          <label className="flex flex-col gap-1 text-zinc-400">
            Radius (ft)
            <input
              type="number"
              min={5}
              step={5}
              value={effect.radiusFt}
              onChange={(e) => onChange({ ...effect, radiusFt: Math.max(5, num(e.target.value, 20)) })}
              className={`w-20 ${FIELD}`}
            />
          </label>
          <label className="flex flex-col gap-1 text-zinc-400">
            Note
            <input
              value={effect.note ?? ""}
              onChange={(e) => onChange({ ...effect, note: e.target.value })}
              placeholder="3d6 Fire, DEX to halve…"
              className={`w-56 ${FIELD}`}
            />
          </label>
        </>
      )}
      {effect?.kind === "custom" && (
        <label className="flex flex-col gap-1 text-zinc-400">
          Text
          <input
            value={effect.text}
            onChange={(e) => onChange({ ...effect, text: e.target.value })}
            placeholder="You hear distant applause."
            className={`w-72 ${FIELD}`}
          />
        </label>
      )}
      <span className="pb-1 text-zinc-500">→ {describeItemEffect(effect)}</span>
    </div>
  );
}

function ItemEditor({
  item,
  asset,
  onPatch,
  onPickIcon,
}: {
  item: ItemRow;
  asset: AssetRow | undefined;
  onPatch: (patch: Partial<ItemRow>) => void;
  onPickIcon: () => void;
}) {
  return (
    <div className="space-y-3 border-t border-zinc-800 pt-3">
      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-1 text-zinc-400">
          Name
          <input
            value={item.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            className={`w-48 ${FIELD}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-zinc-400">
          Kind
          <select value={item.kind} onChange={(e) => onPatch({ kind: e.target.value as ItemKind })} className={FIELD}>
            {ITEM_KINDS.map((k) => (
              <option key={k} value={k}>{ITEM_KIND_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-zinc-400">
          Rarity
          <select
            value={item.rarity}
            onChange={(e) => onPatch({ rarity: e.target.value as ItemRarity })}
            className={FIELD}
            style={{ color: RARITY_COLORS[item.rarity] }}
          >
            {ITEM_RARITIES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 pb-1 text-zinc-300">
          <input
            type="checkbox"
            checked={item.stackable}
            onChange={(e) => onPatch({ stackable: e.target.checked })}
          />
          stackable
        </label>
        <span className="flex items-center gap-2 pb-0.5">
          <button onClick={onPickIcon} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">
            {asset ? "🖼 Change icon" : "🖼 Pick icon"}
          </button>
          {asset && (
            <button
              onClick={() => onPatch({ asset_id: null })}
              className="rounded px-1 text-zinc-600 hover:text-red-400"
              title="Remove icon"
            >
              ✕
            </button>
          )}
        </span>
      </div>
      <label className="flex flex-col gap-1 text-xs text-zinc-400">
        Description
        <textarea
          value={item.description}
          onChange={(e) => onPatch({ description: e.target.value })}
          rows={2}
          placeholder="Flavor + anything the tooltip should say."
          className={FIELD}
        />
      </label>
      <EffectBuilder effect={item.effect} onChange={(effect) => onPatch({ effect })} />
    </div>
  );
}

/* ---------- GM grant flow ---------- */

const GRANT_FLAVOR: Record<ItemKind, string> = {
  consumable: "Don't use it all at once.",
  bomb: "Please aim it away from your party. Or don't.",
  equipment: "Try to look like you deserve it.",
  quest: "This is definitely not a trap.",
  junk: "The System's generosity has limits.",
};

/** Pick crawlers (or the whole party), grant via RPC, and fire the private
 * System reward overlay + an inventory-refresh ping per recipient. */
function GrantDialog({
  item,
  asset,
  party,
  onClose,
}: {
  item: ItemRow;
  asset?: AssetRow;
  party: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function grant() {
    if (selected.size === 0) return;
    setBusy(true);
    setStatus(null);
    const sb = supabase();
    const failures: string[] = [];
    for (const cid of selected) {
      const { error } = await sb.rpc("grant_item", { p_character: cid, p_item: item.id, p_qty: qty });
      if (error) {
        failures.push(
          /grant_item/.test(error.message) ? "Run migration 0013 to enable grants." : error.message,
        );
        continue;
      }
      // The reward-delivery fantasy: a private System overlay with the item's
      // image, plus a silent ping so an open inventory panel refetches.
      const ch = sb.channel(`hud:character:${cid}`);
      await new Promise<void>((resolve) =>
        ch.subscribe((s) => {
          if (s === "SUBSCRIBED") resolve();
        }),
      );
      await ch.send({
        type: "broadcast",
        event: "system_send",
        payload: {
          text: `The System has granted you: ${qty > 1 ? `${qty}× ` : ""}${item.name}. ${GRANT_FLAVOR[item.kind]}`,
          imageUrl: asset ? assetUrl(asset.storage_path) : undefined,
        },
      });
      await ch.send({ type: "broadcast", event: "item_grant", payload: { itemId: item.id } });
      sb.removeChannel(ch);
    }
    setBusy(false);
    setStatus(
      failures.length
        ? [...new Set(failures)].join(" · ")
        : `Granted to ${selected.size} crawler${selected.size === 1 ? "" : "s"}. Open sheets got the overlay.`,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-96 max-w-full rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-display font-semibold tracking-wider text-amber-300">
            🎁 Grant <span style={{ color: RARITY_COLORS[item.rarity] }}>{item.name}</span>
          </h3>
          <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-zinc-200">✕</button>
        </div>
        <div className="mb-3 space-y-1 text-sm">
          {party.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-zinc-300">
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
              {p.name}
            </label>
          ))}
          {party.length === 0 && <p className="text-xs text-zinc-500">No crawlers linked to this campaign yet.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setSelected(new Set(party.map((p) => p.id)))}
            className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700"
          >
            Whole party
          </button>
          <label className="ml-auto flex items-center gap-1 text-zinc-400">
            Qty
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
              className={`w-16 ${FIELD}`}
            />
          </label>
          <button
            onClick={grant}
            disabled={busy || selected.size === 0}
            className="rounded bg-amber-700 px-3 py-1 font-semibold hover:bg-amber-600 disabled:opacity-40"
          >
            {busy ? "Granting…" : "Grant"}
          </button>
        </div>
        {status && <p className="mt-2 text-xs text-emerald-400">{status}</p>}
      </div>
    </div>
  );
}

/** GM item catalog for a campaign: create/edit items with icons and effects.
 * Granting them to crawlers is T9; using them is T11; bombs hit the map in T12. */
export function ItemsPanel({ campaignId }: { campaignId: string }) {
  const { user } = useUser();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [assets, setAssets] = useState<Record<string, AssetRow>>({});
  const [missing, setMissing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);
  const [party, setParty] = useState<{ id: string; name: string }[]>([]);
  const [grantFor, setGrantFor] = useState<ItemRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = supabase();
      const [{ data: itemRows, error }, { data: assetRows }, { data: partyRows }] = await Promise.all([
        sb.from("items").select("*").eq("campaign_id", campaignId).order("created_at"),
        sb.from("assets").select("*").eq("campaign_id", campaignId).in("kind", ["item", "misc"]),
        sb.from("characters").select("id,name").eq("campaign_id", campaignId),
      ]);
      if (cancelled) return;
      if (error) {
        setMissing(true);
        return;
      }
      setItems((itemRows as ItemRow[]) ?? []);
      setAssets(Object.fromEntries(((assetRows as AssetRow[]) ?? []).map((a) => [a.id, a])));
      setParty((partyRows as { id: string; name: string }[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  async function addItem() {
    if (!user) return;
    const { data } = await supabase()
      .from("items")
      .insert({ campaign_id: campaignId, owner_id: user.id, name: "New item" })
      .select("*")
      .single();
    if (data) {
      const row = data as ItemRow;
      setItems((prev) => [...prev, row]);
      setOpenId(row.id);
    } else {
      setMissing(true);
    }
  }

  async function patchItem(id: string, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    await supabase().from("items").update(patch).eq("id", id);
  }

  async function deleteItem(item: ItemRow) {
    if (!window.confirm(`Delete “${item.name}”? Crawlers holding one keep nothing.`)) return;
    setItems((rows) => rows.filter((i) => i.id !== item.id));
    await supabase().from("items").delete().eq("id", item.id);
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-1 flex items-center gap-3">
        <h2 className="font-display font-semibold tracking-wider text-purple-300">▚ ⚗ ITEMS ▞</h2>
        <button
          onClick={addItem}
          disabled={missing}
          className="ml-auto rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700 disabled:opacity-40"
        >
          + New item
        </button>
      </div>
      <p className="mb-3 text-xs text-zinc-400">
        The campaign&apos;s loot catalog. 🎁 grants deliver an item straight to a crawler&apos;s
        inventory with a private System overlay; effects run through the rules engine when used.
      </p>
      {missing && <p className="mb-2 text-xs text-amber-400">Run migration 0012 to enable items.</p>}

      <ul className="space-y-2">
        {items.map((i) => {
          const asset = i.asset_id ? assets[i.asset_id] : undefined;
          return (
            <li key={i.id} className="rounded border border-zinc-800 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  onClick={() => setOpenId(openId === i.id ? null : i.id)}
                  className="flex items-center gap-2 hover:text-amber-300"
                  title="Edit item"
                >
                  <span>{openId === i.id ? "▾" : "▸"}</span>
                  {asset ? (
                    <img
                      src={assetUrl(asset.storage_path)}
                      alt=""
                      className="h-8 w-8 rounded border border-zinc-800 bg-zinc-950 object-contain"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded border border-zinc-800 bg-zinc-950">
                      {ITEM_KIND_LABELS[i.kind].split(" ")[0]}
                    </span>
                  )}
                  <span className="font-semibold" style={{ color: RARITY_COLORS[i.rarity] }}>
                    {i.name || "(unnamed)"}
                  </span>
                </button>
                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
                  {i.kind}
                </span>
                <span className="text-[11px] text-zinc-500">{describeItemEffect(i.effect)}</span>
                <span className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => setGrantFor(i)}
                    disabled={party.length === 0}
                    className="rounded bg-zinc-800 px-2 py-0.5 text-xs hover:bg-zinc-700 disabled:opacity-40"
                    title={party.length ? "Grant to crawlers" : "No crawlers in the campaign yet"}
                  >
                    🎁 Grant
                  </button>
                  <button
                    onClick={() => deleteItem(i)}
                    className="rounded px-1 text-zinc-600 hover:text-red-400"
                    title="Delete item"
                  >
                    ✕
                  </button>
                </span>
              </div>
              {openId === i.id && (
                <ItemEditor
                  item={i}
                  asset={asset}
                  onPatch={(patch) => patchItem(i.id, patch)}
                  onPickIcon={() => setIconPickerFor(i.id)}
                />
              )}
            </li>
          );
        })}
        {items.length === 0 && !missing && (
          <li className="text-xs text-zinc-600">No items yet. The System suggests starting with a potion.</li>
        )}
      </ul>

      {grantFor && (
        <GrantDialog
          item={grantFor}
          asset={grantFor.asset_id ? assets[grantFor.asset_id] : undefined}
          party={party}
          onClose={() => setGrantFor(null)}
        />
      )}

      {iconPickerFor && (
        <AssetPicker
          campaignId={campaignId}
          kinds={["item", "misc"]}
          title="Item icon"
          onPick={(a) => {
            setAssets((prev) => ({ ...prev, [a.id]: a }));
            patchItem(iconPickerFor, { asset_id: a.id });
            setIconPickerFor(null);
          }}
          onClose={() => setIconPickerFor(null)}
        />
      )}
    </section>
  );
}

/* ---------- Player inventory (🎒 rail panel on the sheet) ---------- */

export interface InventoryEntry {
  row: CharacterItemRow;
  /** Null when the GM deleted the catalog item (or the campaign link broke). */
  item: ItemRow | null;
  asset: AssetRow | null;
}

/** Fetch a crawler's inventory with item + icon rows joined client-side.
 * `refresh` bumps refetch (item_grant pings); entries null = still loading. */
export function useInventory(characterId: string, refresh = 0) {
  const [entries, setEntries] = useState<InventoryEntry[] | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = supabase();
      const { data: rows, error } = await sb
        .from("character_items")
        .select("*")
        .eq("character_id", characterId)
        .order("acquired_at");
      if (cancelled) return;
      if (error) {
        setMissing(true);
        setEntries([]);
        return;
      }
      const list = (rows as CharacterItemRow[]) ?? [];
      const itemIds = [...new Set(list.map((r) => r.item_id))];
      const items = itemIds.length
        ? (((await sb.from("items").select("*").in("id", itemIds)).data as ItemRow[]) ?? [])
        : [];
      const assetIds = [...new Set(items.map((i) => i.asset_id).filter(Boolean))] as string[];
      const assets = assetIds.length
        ? (((await sb.from("assets").select("*").in("id", assetIds)).data as AssetRow[]) ?? [])
        : [];
      if (cancelled) return;
      const itemMap = new Map(items.map((i) => [i.id, i]));
      const assetMap = new Map(assets.map((a) => [a.id, a]));
      setEntries(
        list.map((row) => {
          const item = itemMap.get(row.item_id) ?? null;
          return { row, item, asset: item?.asset_id ? (assetMap.get(item.asset_id) ?? null) : null };
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [characterId, refresh]);

  return { entries, missing };
}

/** The crawler's granted items with icons, qty badges, and tooltips. Gold,
 * junk and loot boxes stay with the sheet; this only renders catalog items.
 * `DragWrap` (Hotbar's ItemDrag) makes rows draggable onto the hotbar. */
export function InventoryItems({
  entries,
  missing,
  DragWrap,
}: {
  entries: InventoryEntry[] | null;
  missing: boolean;
  DragWrap?: (props: { entry: InventoryEntry; children: ReactNode }) => ReactNode;
}) {
  if (missing) {
    return <p className="text-xs text-amber-400">Run migration 0013 to enable the item inventory.</p>;
  }
  if (entries === null) return <p className="text-xs text-zinc-500">Loading…</p>;
  return (
    <ul className="space-y-1 text-sm">
      {entries.map((e) => {
        const { row, item, asset } = e;
        if (!item) {
          return (
            <li key={row.id}>
              <span className="text-xs text-zinc-600 line-through">(item removed from the catalog) ×{row.qty}</span>
            </li>
          );
        }
        const inner = (
          <WithItemTooltip item={item} asset={asset} className="flex cursor-default items-center gap-2 rounded px-1 py-0.5 hover:bg-zinc-800/60 focus:bg-zinc-800/60 focus:outline-none">
            {asset ? (
              <img
                src={assetUrl(asset.storage_path)}
                alt=""
                className="h-6 w-6 rounded border border-zinc-800 bg-zinc-950 object-contain"
              />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center text-xs">
                {ITEM_KIND_LABELS[item.kind].split(" ")[0]}
              </span>
            )}
            <span style={{ color: RARITY_COLORS[item.rarity] }}>{item.name}</span>
            {row.qty > 1 && (
              <span className="rounded-full border border-zinc-700 px-1.5 text-[10px] text-zinc-400">
                ×{row.qty}
              </span>
            )}
          </WithItemTooltip>
        );
        return <li key={row.id}>{DragWrap ? <DragWrap entry={e}>{inner}</DragWrap> : inner}</li>;
      })}
      {entries.length === 0 && (
        <li className="text-xs text-zinc-500">No items. The System will provide. Probably.</li>
      )}
    </ul>
  );
}
