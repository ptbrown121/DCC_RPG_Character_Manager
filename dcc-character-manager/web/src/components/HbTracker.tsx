"use client";

import { hbSlotPercentages } from "@/lib/rules";

/**
 * Health Bar tracker: slots fill right-to-left as damage lands (rightmost = 100%).
 * Clicking a slot sets current health to that slot count.
 */
export default function HbTracker({
  slots,
  slotValue,
  current,
  onChange,
  compact = false,
}: {
  slots: number;
  slotValue: number;
  current: number;
  onChange: (next: number) => void;
  compact?: boolean;
}) {
  const pcts = hbSlotPercentages(slots);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {Array.from({ length: slots }, (_, i) => {
        const alive = i < current;
        const pct = pcts[i];
        return (
          <button
            key={i}
            type="button"
            title={`Slot ${i + 1} (${pct}%) — ${slotValue} health`}
            onClick={() => onChange(current === i + 1 ? i : i + 1)}
            className={`${compact ? "h-5 w-5 text-[9px]" : "h-8 w-8 text-xs"} rounded border font-mono transition-colors ${
              alive
                ? current <= Math.ceil(slots * 0.3)
                  ? "border-red-700 bg-red-600/80 text-white"
                  : "border-emerald-700 bg-emerald-600/80 text-white"
                : "border-zinc-700 bg-zinc-800 text-zinc-600"
            }`}
          >
            {slotValue}
          </button>
        );
      })}
      <span className="ml-2 text-xs text-zinc-400">
        {current}/{slots} slots · {current * slotValue} health
      </span>
    </div>
  );
}
