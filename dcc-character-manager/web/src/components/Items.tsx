"use client";

/* eslint-disable @next/next/no-img-element -- storage-hosted user images, next/image adds nothing here */

import { useEffect, useState } from "react";
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
import type { AssetRow, ItemRow } from "@/lib/types";

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

/** GM item catalog for a campaign: create/edit items with icons and effects.
 * Granting them to crawlers is T9; using them is T11; bombs hit the map in T12. */
export function ItemsPanel({ campaignId }: { campaignId: string }) {
  const { user } = useUser();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [assets, setAssets] = useState<Record<string, AssetRow>>({});
  const [missing, setMissing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = supabase();
      const [{ data: itemRows, error }, { data: assetRows }] = await Promise.all([
        sb.from("items").select("*").eq("campaign_id", campaignId).order("created_at"),
        sb.from("assets").select("*").eq("campaign_id", campaignId).in("kind", ["item", "misc"]),
      ]);
      if (cancelled) return;
      if (error) {
        setMissing(true);
        return;
      }
      setItems((itemRows as ItemRow[]) ?? []);
      setAssets(Object.fromEntries(((assetRows as AssetRow[]) ?? []).map((a) => [a.id, a])));
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
        The campaign&apos;s loot catalog. Effects run through the rules engine when a crawler uses
        one; granting items to the party arrives with the inventory update.
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
                <button
                  onClick={() => deleteItem(i)}
                  className="ml-auto rounded px-1 text-zinc-600 hover:text-red-400"
                  title="Delete item"
                >
                  ✕
                </button>
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
