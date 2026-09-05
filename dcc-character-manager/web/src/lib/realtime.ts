"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/*
 * Realtime channels are PRIVATE (migration 0016): Realtime checks RLS on
 * realtime.messages when a client joins, so only the campaign's GM and
 * members can receive, and GM-only topics reject member publishes. The
 * check is per topic, not per event, which is why player-originated
 * traffic (token moves, pings, bombs) gets its own topic next to the GM's.
 * The topic grammar lives in realtimeTopics.ts (pure, unit-tested) and must
 * match `realtime_topic_access()` in migration 0016.
 */
export { topics } from "@/lib/realtimeTopics";

/** Open a private channel. Always go through here so every creator agrees on the config. */
export function privateChannel(topic: string): RealtimeChannel {
  return supabase().channel(topic, { config: { private: true } });
}

/**
 * Subscribe a listen-only channel. A join the policies reject shows up as
 * CHANNEL_ERROR; we log it (the page still works from Postgres, it just
 * won't get live updates) instead of failing silently.
 */
export function listen(ch: RealtimeChannel): RealtimeChannel {
  return ch.subscribe((status, err) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.warn(`realtime: could not join ${ch.topic} (${status})`, err?.message ?? "");
    }
  });
}

/**
 * Subscribe and resolve once joined, for channels we're about to publish on.
 * Rejects on a refused join (not a member / not the GM / 0016 not applied)
 * so the caller can surface it instead of awaiting forever.
 */
export function joined(ch: RealtimeChannel): Promise<RealtimeChannel> {
  return new Promise((resolve, reject) => {
    ch.subscribe((status, err) => {
      if (status === "SUBSCRIBED") resolve(ch);
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(new Error(`Could not join ${ch.topic}: ${err?.message ?? status}`));
      }
    });
  });
}
