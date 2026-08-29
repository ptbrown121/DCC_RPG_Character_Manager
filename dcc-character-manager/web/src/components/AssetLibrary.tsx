"use client";

/* eslint-disable @next/next/no-img-element -- storage-hosted user images, next/image adds nothing here */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { assetUrl, deleteAsset, uploadAsset } from "@/lib/upload";
import type { AssetKind, AssetRow } from "@/lib/types";

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  map: "🗺 Map",
  token: "♟ Token",
  item: "🧪 Item",
  misc: "📦 Misc",
};

const ALL_KINDS: AssetKind[] = ["map", "token", "item", "misc"];

function useAssetList(campaignId: string) {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase()
        .from("assets")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setAssets((data as AssetRow[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);
  return { assets, setAssets, loading };
}

/** Upload a batch of image files as `kind`, reporting per-file failures. */
async function uploadFiles(
  files: FileList | File[],
  campaignId: string,
  kind: AssetKind,
  onUploaded: (asset: AssetRow) => void,
): Promise<string | null> {
  const failures: string[] = [];
  for (const file of Array.from(files)) {
    if (!file.type.startsWith("image/")) {
      failures.push(`${file.name}: not an image`);
      continue;
    }
    try {
      onUploaded(await uploadAsset(file, { campaignId, kind }));
    } catch (e) {
      failures.push(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
    }
  }
  return failures.length ? failures.join(" · ") : null;
}

function Thumb({ asset, className = "" }: { asset: AssetRow; className?: string }) {
  return (
    <img
      src={assetUrl(asset.storage_path)}
      alt={asset.name}
      loading="lazy"
      className={`h-full w-full bg-zinc-950 ${asset.kind === "map" ? "object-cover" : "object-contain"} ${className}`}
    />
  );
}

/** GM's image library for a campaign: upload, browse by kind, rename, delete. */
export function AssetLibrary({ campaignId }: { campaignId: string }) {
  const { assets, setAssets, loading } = useAssetList(campaignId);
  const [filter, setFilter] = useState<AssetKind | "all">("all");
  const [uploadKind, setUploadKind] = useState<AssetKind>("map");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setBusy(true);
      setError(null);
      const err = await uploadFiles(files, campaignId, uploadKind, (a) =>
        setAssets((prev) => [a, ...prev]),
      );
      setError(err);
      setBusy(false);
    },
    [campaignId, uploadKind, setAssets],
  );

  async function commitRename(asset: AssetRow) {
    const name = renameVal.trim();
    setRenameId(null);
    if (!name || name === asset.name) return;
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, name } : a)));
    await supabase().from("assets").update({ name }).eq("id", asset.id);
  }

  async function remove(asset: AssetRow) {
    // Warn if any map uses this image as its background (the map would go blank).
    const { count } = await supabase()
      .from("maps")
      .select("id", { count: "exact", head: true })
      .eq("asset_id", asset.id);
    const inUse = count
      ? ` ⚠ ${count} map${count === 1 ? "" : "s"} use${count === 1 ? "s" : ""} this image as a background and will go blank.`
      : "";
    if (!window.confirm(`Delete “${asset.name}”? The image is removed from storage too.${inUse}`)) return;
    try {
      await deleteAsset(asset);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const shown = filter === "all" ? assets : assets.filter((a) => a.kind === filter);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-1 font-display font-semibold tracking-wider text-amber-300">▚ ASSET LIBRARY ▞</h2>
      <p className="mb-3 text-xs text-zinc-400">
        Maps, tokens and item icons. Everything is downscaled on upload; images are stored on
        the campaign and visible to party members.
      </p>

      {/* Dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        className="mb-3 flex flex-wrap items-center gap-2 rounded border border-dashed border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-400"
      >
        <span>Drop images here, or</span>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded bg-zinc-800 px-2 py-1 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Browse…"}
        </button>
        <span>as</span>
        <select
          value={uploadKind}
          onChange={(e) => setUploadKind(e.target.value as AssetKind)}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1"
        >
          {ALL_KINDS.map((k) => (
            <option key={k} value={k}>{ASSET_KIND_LABELS[k]}</option>
          ))}
        </select>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      {/* Filter chips */}
      <div className="mb-3 flex flex-wrap gap-1 text-xs">
        {(["all", ...ALL_KINDS] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full border px-2 py-0.5 ${
              filter === k ? "border-amber-600 text-amber-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {k === "all" ? `All (${assets.length})` : `${ASSET_KIND_LABELS[k]} (${assets.filter((a) => a.kind === k).length})`}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading && <p className="text-xs text-zinc-500">Loading…</p>}
      {!loading && shown.length === 0 && (
        <p className="text-xs text-zinc-600">Nothing here yet. The dungeon looks better with pictures.</p>
      )}
      <ul className="flex flex-wrap gap-3">
        {shown.map((a) => (
          <li key={a.id} className="group w-28">
            <div className="relative h-20 w-28 overflow-hidden rounded border border-zinc-800">
              <Thumb asset={a} />
              <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[9px] text-zinc-300">
                {a.kind}
              </span>
              <span className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                <button
                  onClick={() => {
                    setRenameId(a.id);
                    setRenameVal(a.name);
                  }}
                  className="rounded bg-black/70 px-1 text-[10px] text-zinc-200 hover:text-amber-300"
                  title="Rename"
                >
                  ✏
                </button>
                <button
                  onClick={() => remove(a)}
                  className="rounded bg-black/70 px-1 text-[10px] text-zinc-200 hover:text-red-400"
                  title="Delete (removes the stored image)"
                >
                  ✕
                </button>
              </span>
            </div>
            {renameId === a.id ? (
              <input
                autoFocus
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={() => commitRename(a)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(a);
                  if (e.key === "Escape") setRenameId(null);
                }}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-[10px]"
              />
            ) : (
              <p className="mt-1 truncate text-[10px] text-zinc-400" title={`${a.name} · ${a.width}×${a.height}`}>
                {a.name}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Modal picker used anywhere a feature needs an image (Area feed, maps, tokens,
 * item icons). Can upload in place so the GM never has to leave the flow.
 */
export function AssetPicker({
  campaignId,
  kinds = ALL_KINDS,
  title = "Pick an image",
  onPick,
  onClose,
}: {
  campaignId: string;
  /** Which kinds to offer; first one is the default filter and upload kind. */
  kinds?: AssetKind[];
  title?: string;
  onPick: (asset: AssetRow) => void;
  onClose: () => void;
}) {
  const { assets, setAssets, loading } = useAssetList(campaignId);
  const [filter, setFilter] = useState<AssetKind>(kinds[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shown = assets.filter((a) => a.kind === filter);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-[36rem] max-w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-display font-semibold tracking-wider text-amber-300">{title}</h3>
          <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-zinc-200">✕</button>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-1 text-xs">
          {kinds.length > 1 &&
            kinds.map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-full border px-2 py-0.5 ${
                  filter === k ? "border-amber-600 text-amber-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                {ASSET_KIND_LABELS[k]}
              </button>
            ))}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="ml-auto rounded bg-zinc-800 px-2 py-1 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            {busy ? "Uploading…" : "⬆ Upload new"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const files = e.target.files;
              e.target.value = "";
              if (!files?.length) return;
              setBusy(true);
              setError(null);
              const err = await uploadFiles(files, campaignId, filter, (a) =>
                setAssets((prev) => [a, ...prev]),
              );
              setError(err);
              setBusy(false);
            }}
          />
        </div>
        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
        {loading && <p className="text-xs text-zinc-500">Loading…</p>}
        {!loading && shown.length === 0 && (
          <p className="text-xs text-zinc-600">No {filter} images yet — upload one above.</p>
        )}
        <ul className="flex flex-wrap gap-3">
          {shown.map((a) => (
            <li key={a.id}>
              <button onClick={() => onPick(a)} className="group w-28 text-left" title={`${a.width}×${a.height}`}>
                <div className="h-20 w-28 overflow-hidden rounded border border-zinc-800 group-hover:border-amber-500">
                  <Thumb asset={a} />
                </div>
                <p className="mt-1 truncate text-[10px] text-zinc-400 group-hover:text-amber-300">{a.name}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
