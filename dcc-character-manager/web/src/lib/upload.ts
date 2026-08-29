import { supabase } from "./supabase";
import type { AssetKind, AssetRow } from "./types";

export const ASSET_BUCKET = "assets";

/** Per-kind downscale caps (longest edge, px) — the Storage cost-control lever. */
export const ASSET_MAX_PX: Record<AssetKind, number> = {
  map: 2560,
  token: 512,
  item: 512,
  misc: 1024,
};

/** Fit (width, height) inside maxPx on the longest edge, never upscaling. */
export function scaleDimensions(width: number, height: number, maxPx: number): { width: number; height: number } {
  const scale = Math.min(1, maxPx / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Re-encode an image file smaller before upload. Prefers webp; Safari's canvas
 * can silently fall back to png, so trust the blob's actual type.
 */
export async function downscaleImage(
  file: Blob,
  maxPx: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = scaleDimensions(bitmap.width, bitmap.height, maxPx);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("Could not encode image");
  return { blob, width, height };
}

/**
 * Downscale + upload to Storage + insert the assets row. Storage policies only
 * allow writes under the caller's own {auth.uid()}/ folder. If the row insert
 * fails, the uploaded object is removed so nothing is orphaned.
 */
export async function uploadAsset(
  file: File,
  opts: { campaignId: string; kind: AssetKind; name?: string },
): Promise<AssetRow> {
  const sb = supabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");

  const { blob, width, height } = await downscaleImage(file, ASSET_MAX_PX[opts.kind]);
  const ext = blob.type === "image/webp" ? "webp" : "png";
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await sb.storage
    .from(ASSET_BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
  if (upErr) throw upErr;

  const { data, error } = await sb
    .from("assets")
    .insert({
      owner_id: auth.user.id,
      campaign_id: opts.campaignId,
      kind: opts.kind,
      name: opts.name?.trim() || file.name.replace(/\.[^.]+$/, "") || "Untitled",
      storage_path: path,
      width,
      height,
    })
    .select("*")
    .single();
  if (error) {
    await sb.storage.from(ASSET_BUCKET).remove([path]);
    throw error;
  }
  return data as AssetRow;
}

/** Public URL for an asset's image (bucket is public; paths are unguessable). */
export function assetUrl(storagePath: string): string {
  return supabase().storage.from(ASSET_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/** Delete the storage object and its row (object first, so no orphaned files). */
export async function deleteAsset(asset: Pick<AssetRow, "id" | "storage_path">): Promise<void> {
  const sb = supabase();
  const { error: rmErr } = await sb.storage.from(ASSET_BUCKET).remove([asset.storage_path]);
  if (rmErr) throw rmErr;
  const { error } = await sb.from("assets").delete().eq("id", asset.id);
  if (error) throw error;
}
