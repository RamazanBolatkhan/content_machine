import type { Metadata } from "next";
import Link from "next/link";
import { DM_Sans } from "next/font/google";
import { TriangleAlert } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { aiConfigured, aiSetupHint } from "@/lib/ai";
import "./globals.css";

// Fallback for "New Transport" (see globals.css)
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Content Machine",
  description: "Turn X posts, bookmarks and AI news into ready-to-post social posts in six languages",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const aiProblem = aiConfigured() ? null : aiSetupHint();

  return (
    <html lang="en" className={`${dmSans.variable} antialiased`}>
      <body className="min-h-screen bg-bg font-sans text-fg">
        <header className="sticky top-0 z-10 border-b border-line bg-bg">
          <nav className="mx-auto flex h-16 max-w-6xl items-center gap-10 px-4 md:px-6">
            <Link href="/" className="t-h6 flex items-center gap-2.5" aria-label="Content Machine, home">
              <LogoMark size={32} />
              <span aria-hidden>Content Machine</span>
            </Link>
            <NavLinks />
          </nav>
        </header>
        {aiProblem && (
          <div className="border-b border-line bg-surface">
            <p className="t-small mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 md:px-6">
              <TriangleAlert size={16} aria-hidden /> {aiProblem}. See <code>.env.example</code>.
            </p>
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">{children}</main>
      </body>
    </html>
  );
}
