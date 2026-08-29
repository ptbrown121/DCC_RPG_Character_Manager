"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (key?.startsWith("sb_secret_")) {
      throw new Error(
        "You've put a Supabase SECRET key in a NEXT_PUBLIC_ env var. Use the publishable key (sb_publishable_...) in the browser; secret keys are server-only.",
      );
    }
    client = createBrowserClient(url, key);
  }
  return client;
}
