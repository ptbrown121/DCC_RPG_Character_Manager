"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/characters/new", label: "New Crawler" },
  { href: "/encounters/new", label: "New Encounter" },
  { href: "/campaigns/new", label: "New Campaign" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <Link href="/" className="font-display font-bold tracking-widest text-amber-400">
          🐾 DCC MANAGER
        </Link>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm transition-colors ${
              pathname === l.href
                ? "font-semibold text-amber-400"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {l.label}
          </Link>
        ))}
        {user && (
          <button
            onClick={async () => {
              await supabase().auth.signOut();
              router.replace("/login");
            }}
            className="ml-auto text-xs text-zinc-400 hover:text-white"
            title={user.email ?? undefined}
          >
            Sign out
          </button>
        )}
      </div>
    </nav>
  );
}
