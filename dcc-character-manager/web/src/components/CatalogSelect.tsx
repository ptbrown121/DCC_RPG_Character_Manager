"use client";

import {
  ATTACK_SKILLS,
  DAMAGE_EFFECTS,
  UTILITY_SKILLS,
  SPELL_CATALOG,
  catalogSkill,
  catalogSpell,
  type CatalogSkill,
  type CatalogSpell,
} from "@/lib/rules";

const selectCls = "rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm";

export function SkillSelect({
  onPick,
  exclude = [],
  className,
}: {
  onPick: (skill: CatalogSkill) => void;
  exclude?: string[];
  className?: string;
}) {
  const groups: [string, CatalogSkill[]][] = [
    ["Attack skills", ATTACK_SKILLS],
    ["Damage effects (hand-to-hand)", DAMAGE_EFFECTS],
    ["Utility skills", UTILITY_SKILLS],
  ];
  return (
    <select
      value=""
      onChange={(e) => {
        const s = catalogSkill(e.target.value);
        if (s) onPick(s);
      }}
      className={className ?? selectCls}
    >
      <option value="">+ Add skill from catalog…</option>
      {groups.map(([label, list]) => (
        <optgroup key={label} label={label}>
          {list
            .filter((s) => !exclude.includes(s.name))
            .map((s) => (
              <option key={s.name} value={s.name} title={s.damage ?? s.effect}>
                {s.name}
                {s.animalOnly ? " 🐾" : ""}
                {s.damage ? ` — ${s.damage}` : s.stat ? ` (${s.stat.toUpperCase()})` : " (Passive)"}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

export function SpellSelect({
  onPick,
  exclude = [],
  starterOnly = false,
  className,
}: {
  onPick: (spell: CatalogSpell) => void;
  exclude?: string[];
  starterOnly?: boolean;
  className?: string;
}) {
  const spells = SPELL_CATALOG.filter(
    (s) => !exclude.includes(s.name) && (!starterOnly || s.starterOption),
  );
  return (
    <select
      value=""
      onChange={(e) => {
        const s = catalogSpell(e.target.value);
        if (s) onPick(s);
      }}
      className={className ?? selectCls}
    >
      <option value="">+ Add spell…</option>
      {spells.map((s) => (
        <option key={s.name} value={s.name} title={s.effect}>
          {s.name} — {s.mana} Mana ({s.type})
        </option>
      ))}
    </select>
  );
}
