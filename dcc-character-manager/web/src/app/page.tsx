"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGate, { useUser } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";
import { statMod, FLOOR_TIMERS, STRENGTH_LABELS } from "@/lib/rules";
import type { Campaign, Character, Encounter } from "@/lib/types";

function Dashboard() {
  const { user } = useUser();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    if (!user) return;
    const sb = supabase();
    sb.from("characters")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setCharacters((data as Character[]) ?? []));
    sb.from("encounters")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setEncounters((data as Encounter[]) ?? []));
    sb.from("campaigns")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setCampaigns((data as Campaign[]) ?? []));
  }, [user]);

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Crawlers</h2>
          <Link href="/characters/new" className="text-sm text-amber-400 hover:underline">
            + New
          </Link>
        </div>
        {characters.length === 0 && (
          <p className="text-sm text-zinc-500">No crawlers yet. The dungeon awaits.</p>
        )}
        <ul className="space-y-2">
          {characters.map((c) => {
            const conMod = statMod(c.stats.enhanced.con);
            return (
              <li key={c.id}>
                <Link
                  href={`/characters/${c.id}`}
                  className="block rounded-lg border border-zinc-800 bg-zinc-900 p-3 hover:border-amber-600"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-xs text-zinc-400">
                      Lv {c.level} · Floor {c.floor}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {[c.race, c.class].filter(Boolean).join(" ") || "No race/class (pre-Floor 3)"} ·
                    HB {c.current_hb_slots}/10 ({c.current_hb_slots * conMod}/{conMod * 10}) · Mana{" "}
                    {c.current_mana}/{c.stats.enhanced.int}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Encounters</h2>
          <Link href="/encounters/new" className="text-sm text-amber-400 hover:underline">
            + New
          </Link>
        </div>
        {encounters.length === 0 && (
          <p className="text-sm text-zinc-500">No encounters yet.</p>
        )}
        <ul className="space-y-2">
          {encounters.map((e) => (
            <li key={e.id}>
              <Link
                href={`/encounters/${e.id}`}
                className="block rounded-lg border border-zinc-800 bg-zinc-900 p-3 hover:border-amber-600"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{e.name}</span>
                  <span
                    className={`text-xs ${
                      e.status === "running"
                        ? "text-emerald-400"
                        : e.status === "done"
                          ? "text-zinc-500"
                          : "text-amber-400"
                    }`}
                  >
                    {e.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-zinc-400">
                  Floor {e.floor}
                  {FLOOR_TIMERS[e.floor] ? ` (${FLOOR_TIMERS[e.floor]}-day floor)` : ""} ·{" "}
                  {STRENGTH_LABELS[e.strength]} · party of {e.party_size}
                  {e.round > 0 ? ` · round ${e.round}` : ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="md:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Campaigns</h2>
          <Link href="/campaigns/new" className="text-sm text-amber-400 hover:underline">
            + New
          </Link>
        </div>
        {campaigns.length === 0 && <p className="text-sm text-zinc-500">No campaigns yet.</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {campaigns.map((cp) => (
            <li key={cp.id}>
              <Link
                href={`/campaigns/${cp.id}`}
                className="block rounded-lg border border-zinc-800 bg-zinc-900 p-3 hover:border-amber-600"
              >
                <span className="font-semibold">{cp.name}</span>
                <div className="mt-1 text-xs text-zinc-400">
                  {cp.achievements.length} achievement{cp.achievements.length === 1 ? "" : "s"} logged
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <div className="md:col-span-2">
        <button
          onClick={() => supabase().auth.signOut()}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}
