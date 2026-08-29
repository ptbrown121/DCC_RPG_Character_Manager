"use client";

import {
  WORSHIP_TIERS,
  BOON_STREAK_DAYS,
  FAN_BOX_MILESTONES,
  MAX_SPONSORS,
  POPULARITY_START_FLOOR,
  TOP_TEN_START_FLOOR,
  nextFanBox,
  type WorshipTier,
} from "@/lib/rules";
import type { Character, SocialState, SponsorEntry } from "@/lib/types";

export default function FameFaithPanel({
  character,
  onPatch,
}: {
  character: Character;
  onPatch: (patch: Partial<Character>) => void;
}) {
  const social: SocialState = character.social ?? {};
  const pop = social.popularity ?? 0;
  const sponsors = social.sponsors ?? [];
  const deity = social.deity;
  const boonDue = deity && deity.streak > 0 && deity.streak % BOON_STREAK_DAYS === 0;

  function patchSocial(patch: Partial<SocialState>) {
    onPatch({ social: { ...social, ...patch } });
  }

  function patchSponsor(i: number, patch: Partial<SponsorEntry>) {
    patchSocial({ sponsors: sponsors.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-3 font-semibold">Fame &amp; Faith</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Popularity */}
        <div className="rounded border border-zinc-800 bg-zinc-950 p-3 text-sm">
          <div className="text-xs uppercase text-zinc-500">Popularity</div>
          {character.floor < POPULARITY_START_FLOOR && (
            <p className="mt-1 text-[10px] text-zinc-600">Numeric from Floor {POPULARITY_START_FLOOR} (narrative before).</p>
          )}
          <div className="mt-1 flex items-center gap-2">
            <button className="rounded bg-zinc-800 px-2" onClick={() => patchSocial({ popularity: Math.max(0, pop - 1) })}>−</button>
            <span className="w-12 text-center text-lg font-bold">{pop}</span>
            <button className="rounded bg-zinc-800 px-2" onClick={() => patchSocial({ popularity: pop + 1 })}>+</button>
          </div>
          <div className="mt-2 flex gap-1">
            {FAN_BOX_MILESTONES.map((m) => (
              <span
                key={m}
                className={`rounded-full px-2 py-0.5 text-[10px] ${pop >= m ? "bg-amber-500 font-semibold text-zinc-950" : "bg-zinc-800 text-zinc-500"}`}
                title={pop >= m ? "Fan Box earned" : "Fan Box at this milestone"}
              >
                🎁 {m}
              </span>
            ))}
          </div>
          {nextFanBox(pop) !== null && (
            <p className="mt-1 text-[10px] text-zinc-500">Next Fan Box at {nextFanBox(pop)}.</p>
          )}
          <div className="mt-3 text-xs">
            <label className="text-zinc-500">
              Top Ten place{" "}
              <input
                type="number"
                min={1}
                max={10}
                value={social.top_ten ?? ""}
                onChange={(e) => patchSocial({ top_ten: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="—"
                className="w-12 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-center"
              />
            </label>
            {character.floor < TOP_TEN_START_FLOOR && <span className="ml-1 text-[10px] text-zinc-600">(from Floor {TOP_TEN_START_FLOOR})</span>}
            <input
              placeholder="Bounty on you…"
              value={social.bounty ?? ""}
              onChange={(e) => patchSocial({ bounty: e.target.value })}
              className="mt-2 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
            />
          </div>
        </div>

        {/* Sponsors */}
        <div className="rounded border border-zinc-800 bg-zinc-950 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase text-zinc-500">Sponsors ({sponsors.length}/{MAX_SPONSORS})</span>
            <button
              disabled={sponsors.length >= MAX_SPONSORS}
              onClick={() => patchSocial({ sponsors: [...sponsors, { name: "", floor: character.floor, notes: "" }] })}
              className="rounded bg-zinc-800 px-2 py-0.5 text-xs hover:bg-zinc-700 disabled:opacity-30"
            >
              + Add
            </button>
          </div>
          <p className="mt-1 text-[10px] text-zinc-600">Max {MAX_SPONSORS}, at most one gained per floor. Benefactor Boxes come from these.</p>
          <div className="mt-2 space-y-2">
            {sponsors.map((s, i) => (
              <div key={i} className="rounded border border-zinc-800 p-2 text-xs">
                <div className="flex items-center gap-2">
                  <input placeholder="Sponsor" value={s.name} onChange={(e) => patchSponsor(i, { name: e.target.value })} className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1" />
                  <label className="text-zinc-500">
                    F<input type="number" min={1} value={s.floor} onChange={(e) => patchSponsor(i, { floor: Number(e.target.value) })} className="w-10 rounded border border-zinc-700 bg-zinc-800 px-1 py-1 text-center" />
                  </label>
                  <button onClick={() => patchSocial({ sponsors: sponsors.filter((_, j) => j !== i) })} className="text-zinc-600 hover:text-red-400">✕</button>
                </div>
                <input placeholder="Benefactor boxes / terms…" value={s.notes} onChange={(e) => patchSponsor(i, { notes: e.target.value })} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1" />
              </div>
            ))}
            {sponsors.length === 0 && <p className="text-xs text-zinc-600">No sponsors yet.</p>}
          </div>
        </div>

        {/* Worship */}
        <div className="rounded border border-zinc-800 bg-zinc-950 p-3 text-sm">
          <div className="text-xs uppercase text-zinc-500">Worship</div>
          <input
            placeholder="Deity (none)"
            value={deity?.name ?? ""}
            onChange={(e) =>
              patchSocial({
                deity: e.target.value
                  ? { name: e.target.value, tier: deity?.tier ?? "acolyte", streak: deity?.streak ?? 0, lapse: deity?.lapse ?? "" }
                  : undefined,
              })
            }
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
          />
          {deity && (
            <>
              <select
                value={deity.tier}
                onChange={(e) => patchSocial({ deity: { ...deity, tier: e.target.value as WorshipTier } })}
                className="mt-2 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
              >
                {WORSHIP_TIERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} — tithe {t.tithePct}%
                  </option>
                ))}
              </select>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-zinc-500">Offering streak</span>
                <button className="rounded bg-zinc-800 px-1.5" onClick={() => patchSocial({ deity: { ...deity, streak: Math.max(0, deity.streak - 1) } })}>−</button>
                <b className={boonDue ? "text-amber-400" : ""}>{deity.streak}d</b>
                <button className="rounded bg-zinc-800 px-1.5" onClick={() => patchSocial({ deity: { ...deity, streak: deity.streak + 1 } })}>+</button>
                <button className="rounded bg-red-950 px-1.5 text-red-300" title="Missed offering — streak resets, note the lapse penalty" onClick={() => patchSocial({ deity: { ...deity, streak: 0 } })}>
                  missed
                </button>
              </div>
              {boonDue && <p className="mt-1 text-[10px] font-semibold text-amber-400">🕯 Boon due ({BOON_STREAK_DAYS}-day streak)!</p>}
              <input
                placeholder="Lapse penalty stage / penitence…"
                value={deity.lapse}
                onChange={(e) => patchSocial({ deity: { ...deity, lapse: e.target.value } })}
                className="mt-2 w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs"
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
