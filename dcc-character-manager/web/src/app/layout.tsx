import type { Metadata } from "next";
import { Inter, Chakra_Petch } from "next/font/google";
import NavBar from "@/components/NavBar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const chakra = Chakra_Petch({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-chakra",
});

export const metadata: Metadata = {
  title: "DCC Character Manager",
  description: "Character manager and GM campaign tools for the Dungeon Crawler Carl RPG",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${chakra.variable}`}>
      <body className="min-h-screen font-sans text-zinc-100 antialiased">
        <NavBar />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
