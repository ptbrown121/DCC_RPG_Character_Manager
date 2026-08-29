"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate, { useUser } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";
import { defaultCollapseDays, DEFAULT_JANITORS } from "@/lib/rules";

function NewCampaign() {
  const { user } = useUser();
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!user || !name.trim()) {
      setError("Campaign name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const sb = supabase();
    const { data: camp, error: cErr } = await sb
      .from("campaigns")
      .insert({ owner_id: user.id, name: name.trim() })
      .select("id")
      .single();
    if (cErr || !camp) {
      setSaving(false);
      setError(cErr?.message ?? "Failed to create campaign");
      return;
    }
    // Seed Floors 1–5 with book collapse timers and known janitors.
    const floors = [1, 2, 3, 4, 5].map((n) => ({
      campaign_id: camp.id,
      owner_id: user.id,
      floor_number: n,
      collapse_days: defaultCollapseDays(n),
      janitor: DEFAULT_JANITORS[n] ?? null,
      status: n === 1 ? "active" : "upcoming",
    }));
    const { error: fErr } = await sb.from("campaign_floors").insert(floors);
    setSaving(false);
    if (fErr) {
      setError(fErr.message);
      return;
    }
    router.push(`/campaigns/${camp.id}`);
  }

  return (
    <div className="mx-auto mt-12 max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <h1 className="mb-1 text-xl font-bold">New Campaign</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Seeds Floors 1–5 with the book collapse timers (5/6/8/10/15 dungeon days of 30 hours).
      </p>
      <input
        placeholder="Campaign name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-3 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
      />
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
      >
        {saving ? "Creating…" : "Create Campaign"}
      </button>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <NewCampaign />
    </AuthGate>
  );
}
