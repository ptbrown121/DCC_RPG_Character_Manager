import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "DCC Character Manager",
  description: "Character manager and GM campaign tools for the Dungeon Crawler Carl RPG",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased">
        <nav className="border-b border-zinc-800 bg-zinc-900/80">
          <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-bold tracking-wide text-amber-400">
              🐾 DCC Manager
            </Link>
            <Link href="/" className="text-sm text-zinc-300 hover:text-white">
              Dashboard
            </Link>
            <Link href="/characters/new" className="text-sm text-zinc-300 hover:text-white">
              New Crawler
            </Link>
            <Link href="/encounters/new" className="text-sm text-zinc-300 hover:text-white">
              New Encounter
            </Link>
            <Link href="/campaigns/new" className="text-sm text-zinc-300 hover:text-white">
              New Campaign
            </Link>
          </div>
        </nav>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
