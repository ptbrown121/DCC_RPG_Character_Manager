"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function googleSignIn() {
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    // On success the browser navigates away; only errors come back here.
    if (error) {
      setBusy(false);
      setError(error.message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const sb = supabase();
    const { error } =
      mode === "signin"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/");
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <h1 className="mb-1 text-xl font-bold">Welcome, Crawler.</h1>
      <p className="mb-4 text-sm text-zinc-400">
        {mode === "signin" ? "Sign in to your account." : "Create an account."}
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? "…" : mode === "signin" ? "Sign In" : "Sign Up"}
        </button>
      </form>
      <div className="my-4 flex items-center gap-3 text-xs text-zinc-500">
        <div className="h-px flex-1 bg-zinc-800" />
        or
        <div className="h-px flex-1 bg-zinc-800" />
      </div>
      <button
        type="button"
        onClick={googleSignIn}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-semibold hover:bg-zinc-700 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.6 2.8c2.2-2 3.8-5 3.8-8.8z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.6-2.8c-1 .7-2.4 1.2-4.3 1.2-3.1 0-5.8-2.1-6.8-5l-3.7 2.9C3.5 21.3 7.4 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.2 14.5c-.2-.7-.4-1.4-.4-2.5s.2-1.8.4-2.5L1.5 6.6C.5 8.6 0 10.2 0 12s.5 3.4 1.5 5.4l3.7-2.9z"
          />
          <path
            fill="#EA4335"
            d="M12 4.6c2.2 0 3.7.9 4.6 1.7l3.4-3.3C17.9 1.1 15.2 0 12 0 7.4 0 3.5 2.7 1.5 6.6l3.7 2.9c1-2.9 3.7-4.9 6.8-4.9z"
          />
        </svg>
        Continue with Google
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-3 text-xs text-zinc-400 hover:text-white"
      >
        {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
    </div>
  );
}
