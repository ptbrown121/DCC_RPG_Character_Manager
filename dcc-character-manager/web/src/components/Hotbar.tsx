"use client";

/* eslint-disable @next/next/no-img-element -- storage-hosted user images, next/image adds nothing here */

import { useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { assetUrl } from "@/lib/upload";
import { clearSlot, normalizeHotbar, placeEntry, swapSlots } from "@/lib/hotbar";
import { ITEM_KIND_LABELS, RARITY_COLORS, WithItemTooltip, type InventoryEntry } from "./Items";
import type { HotbarEntry, SpellRow } from "@/lib/types";

/*
 * Unified drag & drop hotbar (T10, plan D6): 10 explicit slots holding spells
 * and items, persisted to characters.hotbar. dnd-kit runs the inventory/spell
 * panel → slot drops and slot ⇄ slot swaps; dropping a slot anywhere off the
 * bar clears it. Slot math is pure in src/lib/hotbar.ts.
 */

type DragData = {
  entry: NonNullable<HotbarEntry>;
  /** Set when the drag started on a bar slot (enables swap / drag-off-clear). */
  from?: number;
  label: string;
  iconUrl?: string;
};

/** Context provider wrapping everything that can drag onto the bar. */
export function HotbarDnd({
  bar,
  onChange,
  children,
}: {
  bar: HotbarEntry[] | null;
  onChange: (next: HotbarEntry[]) => void;
  children: ReactNode;
}) {
  const [active, setActive] = useState<DragData | null>(null);
  // A small distance threshold keeps plain clicks (cast / use) from starting drags.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragStart(e: DragStartEvent) {
    setActive((e.active.data.current as DragData) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    const data = e.active.data.current as DragData | undefined;
    setActive(null);
    if (!data || !bar) return;
    const overId = e.over?.id;
    if (typeof overId === "string" && overId.startsWith("slot-")) {
      const to = Number(overId.slice(5));
      if (data.from !== undefined) {
        if (data.from !== to) onChange(swapSlots(bar, data.from, to));
      } else {
        onChange(placeEntry(bar, to, data.entry));
      }
    } else if (data.from !== undefined) {
      // Dropped off the bar entirely → clear the slot.
      onChange(clearSlot(bar, data.from));
    }
  }

  // pointerWithin: drops resolve at the cursor, not by rect overlap — wide
  // inventory rows would otherwise blanket several 48px slots at once.
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active && (
          <span className="flex items-center gap-1 rounded border border-amber-500 bg-zinc-950/95 px-2 py-1 text-xs text-amber-200 shadow-lg">
            {active.iconUrl && <img src={active.iconUrl} alt="" className="h-5 w-5 object-contain" />}
            {active.label}
          </span>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/** Generic drag handle wrapper for panel rows. */
function DragSource({
  id,
  data,
  children,
  className = "",
}: {
  id: string;
  data: DragData;
  children: ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  return (
    <span
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`${className} touch-none ${isDragging ? "opacity-40" : ""}`}
      style={{ cursor: "grab" }}
    >
      {children}
    </span>
  );
}

/** Makes a spell-panel row draggable onto the bar. */
export function SpellDrag({ spell, children }: { spell: SpellRow; children: ReactNode }) {
  return (
    <DragSource
      id={`spell-src-${spell.name}`}
      data={{ entry: { type: "spell", id: spell.name }, label: spell.name }}
    >
      {children}
    </DragSource>
  );
}

/** Makes an inventory-panel row draggable onto the bar. */
export function ItemDrag({ entry, children }: { entry: InventoryEntry; children: ReactNode }) {
  if (!entry.item) return <>{children}</>;
  return (
    <DragSource
      id={`item-src-${entry.item.id}`}
      data={{
        entry: { type: "item", id: entry.item.id },
        label: entry.item.name,
        iconUrl: entry.asset ? assetUrl(entry.asset.storage_path) : undefined,
      }}
    >
      {children}
    </DragSource>
  );
}

const SLOT_BASE = "relative h-12 w-12 rounded border text-[9px] leading-tight";

function HotbarSlot({
  index,
  entry,
  spells,
  inventory,
  mana,
  onCast,
  onUseItem,
}: {
  index: number;
  entry: HotbarEntry;
  spells: SpellRow[];
  inventory: InventoryEntry[];
  mana: number;
  onCast: (sp: SpellRow) => void;
  onUseItem: (inv: InventoryEntry) => void;
}) {
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: `slot-${index}` });
  const spell = entry?.type === "spell" ? spells.find((s) => s.name === entry.id) : undefined;
  const inv = entry?.type === "item" ? inventory.find((e) => e.item?.id === entry.id) : undefined;
  const item = inv?.item ?? null;
  const label =
    entry === null
      ? `Empty slot ${(index + 1) % 10}`
      : spell
        ? `${spell.name} — ${spell.mana} Mana`
        : item
          ? `${item.name} ×${inv!.row.qty}`
          : "No longer available";

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `slotdrag-${index}`,
    disabled: entry === null,
    data: entry
      ? ({
          entry,
          from: index,
          label: spell?.name ?? item?.name ?? "???",
          iconUrl: inv?.asset ? assetUrl(inv.asset.storage_path) : undefined,
        } satisfies DragData)
      : undefined,
  });

  const button = (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Hotbar slot ${(index + 1) % 10}: ${label}`}
      title={label}
      disabled={entry === null}
      onClick={() => {
        if (spell) onCast(spell);
        else if (inv) onUseItem(inv);
      }}
      className={`${SLOT_BASE} touch-none ${isDragging ? "opacity-30" : ""} ${
        isOver
          ? "border-amber-400 bg-amber-950/60"
          : spell
            ? "border-indigo-700 bg-indigo-950/90 text-indigo-100 hover:border-indigo-400"
            : item
              ? "bg-zinc-950/90 hover:brightness-125"
              : entry
                ? "border-zinc-800 bg-zinc-950/70"
                : "border-zinc-800 bg-zinc-950/70"
      }`}
      style={item ? { borderColor: isOver ? undefined : `${RARITY_COLORS[item.rarity]}88` } : undefined}
    >
      <span className="absolute left-0.5 top-0 text-[8px] text-zinc-600">{(index + 1) % 10}</span>
      {spell && (
        <>
          <span className="block overflow-hidden px-0.5 pt-1">{spell.name}</span>
          <span className={`block ${mana < spell.mana ? "text-zinc-600" : "text-sky-400"}`}>{spell.mana}mp</span>
        </>
      )}
      {item && (
        <>
          {inv?.asset ? (
            <img src={assetUrl(inv.asset.storage_path)} alt="" className="mx-auto mt-1 h-7 w-7 object-contain" />
          ) : (
            <span className="block pt-2 text-base">{ITEM_KIND_LABELS[item.kind].split(" ")[0]}</span>
          )}
          {inv!.row.qty > 1 && (
            <span className="absolute bottom-0 right-0.5 font-display text-[9px] text-amber-300">
              ×{inv!.row.qty}
            </span>
          )}
        </>
      )}
      {entry && !spell && !item && <span className="block pt-3 text-zinc-600 line-through">gone</span>}
    </button>
  );

  return (
    <div ref={dropRef}>
      {item ? (
        <WithItemTooltip item={item} asset={inv?.asset}>
          {button}
        </WithItemTooltip>
      ) : (
        button
      )}
    </div>
  );
}

/** The 10-slot bar itself (replaces the spells-only Hotlist once 0013 ran). */
export function Hotbar({
  bar,
  spells,
  inventory,
  mana,
  onCast,
  onUseItem,
}: {
  bar: HotbarEntry[];
  spells: SpellRow[];
  inventory: InventoryEntry[];
  mana: number;
  onCast: (sp: SpellRow) => void;
  onUseItem: (inv: InventoryEntry) => void;
}) {
  const slots = normalizeHotbar(bar);
  return (
    <div className="hud-item fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-1">
      {slots.map((e, i) => (
        <HotbarSlot
          key={i}
          index={i}
          entry={e}
          spells={spells}
          inventory={inventory}
          mana={mana}
          onCast={onCast}
          onUseItem={onUseItem}
        />
      ))}
    </div>
  );
}
