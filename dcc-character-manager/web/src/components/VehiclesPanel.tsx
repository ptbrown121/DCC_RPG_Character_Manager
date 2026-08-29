"use client";

import { useState } from "react";
import HbTracker from "@/components/HbTracker";
import {
  SAMPLE_VEHICLES,
  VEHICLE_HB_SLOTS,
  vehicleExplosion,
  ramDice,
} from "@/lib/rules";
import type { Campaign, VehicleEntry } from "@/lib/types";

export default function VehiclesPanel({
  campaign,
  floor,
  onPatch,
}: {
  campaign: Campaign;
  floor: number;
  onPatch: (patch: Partial<Campaign>) => void;
}) {
  const vehicles = campaign.vehicles ?? [];
  const [pick, setPick] = useState("");

  function addVehicle(template?: (typeof SAMPLE_VEHICLES)[number]) {
    const v: VehicleEntry = template
      ? { name: template.name, move: template.move, size: template.size, dr: template.dr, occupancy: template.occupancy, current_slots: VEHICLE_HB_SLOTS, upgrades: "" }
      : { name: "Custom vehicle", move: 60, size: 5, dr: 2, occupancy: "4", current_slots: VEHICLE_HB_SLOTS, upgrades: "" };
    onPatch({ vehicles: [...vehicles, v] });
    setPick("");
  }

  function patch(i: number, p: Partial<VehicleEntry>) {
    onPatch({ vehicles: vehicles.map((v, j) => (j === i ? { ...v, ...p } : v)) });
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Vehicles</h2>
        <span className="text-xs text-zinc-500">
          10 HB slots of the vehicle&apos;s size · occupants add the vehicle&apos;s DR to theirs
        </span>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <select
            value={pick}
            onChange={(e) => {
              setPick(e.target.value);
              const t = SAMPLE_VEHICLES.find((v) => v.name === e.target.value);
              if (t) addVehicle(t);
            }}
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
          >
            <option value="">+ Add from Table 7…</option>
            {SAMPLE_VEHICLES.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name} — Move {v.move}, Size {v.size}, DR {v.dr}
              </option>
            ))}
          </select>
          <button onClick={() => addVehicle()} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">+ Custom</button>
        </div>
      </div>
      <div className="space-y-3">
        {vehicles.map((v, i) => {
          const wrecked = v.current_slots === 0;
          return (
            <div key={i} className={`rounded border p-3 text-sm ${wrecked ? "border-red-900 bg-zinc-950" : "border-zinc-800 bg-zinc-950"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <input value={v.name} onChange={(e) => patch(i, { name: e.target.value })} className="w-40 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-semibold" />
                {(
                  [
                    ["move", "Move"],
                    ["size", "Size"],
                    ["dr", "DR"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="text-xs text-zinc-400">
                    {label}{" "}
                    <input
                      type="number"
                      min={key === "size" ? 1 : 0}
                      max={key === "size" ? 8 : undefined}
                      value={v[key]}
                      onChange={(e) => patch(i, { [key]: Number(e.target.value) } as Partial<VehicleEntry>)}
                      className="w-14 rounded border border-zinc-700 bg-zinc-800 px-1 py-1 text-center"
                    />
                  </label>
                ))}
                <label className="text-xs text-zinc-400">
                  Seats <input value={v.occupancy} onChange={(e) => patch(i, { occupancy: e.target.value })} className="w-20 rounded border border-zinc-700 bg-zinc-800 px-1 py-1 text-center" />
                </label>
                <span className="ml-auto text-xs text-zinc-500">
                  Ram: <b className="text-amber-300">{ramDice(v.size, v.move)}d6</b> (rammer takes half, halves Move)
                </span>
                <button onClick={() => onPatch({ vehicles: vehicles.filter((_, j) => j !== i) })} className="text-zinc-600 hover:text-red-400">✕</button>
              </div>
              <div className="mt-2">
                <HbTracker
                  slots={VEHICLE_HB_SLOTS}
                  slotValue={v.size}
                  current={v.current_slots}
                  onChange={(n) => patch(i, { current_slots: n })}
                />
              </div>
              {wrecked && (
                <p className="mt-1 text-xs font-semibold text-red-400">
                  💥 BOOM — explodes for {vehicleExplosion(v.size, floor)} to occupants (vehicle DR does not protect).
                </p>
              )}
              <input
                placeholder="Upgrades (armor/smithing, mounted weapons/engineering, speed/gear head…)"
                value={v.upgrades}
                onChange={(e) => patch(i, { upgrades: e.target.value })}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
              />
            </div>
          );
        })}
        {vehicles.length === 0 && <p className="text-xs text-zinc-500">Garage is empty.</p>}
      </div>
    </section>
  );
}
