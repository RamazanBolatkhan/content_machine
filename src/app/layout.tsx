import type { Metadata } from "next";
import Link from "next/link";
import { DM_Sans } from "next/font/google";
import { LogoMark } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { Suspense } from "react";
import { WorkerBanner } from "@/components/WorkerBanner";
import "./globals.css";

// Fallback for "New Transport" (see globals.css)
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Content Machine",
  description: "Turn X posts, bookmarks and AI news into ready-to-post social posts in six languages",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} antialiased`}>
      <body className="min-h-screen bg-bg font-sans text-fg">
        <header className="workspace-header sticky top-0 z-10 border-b border-line">
          <nav className="mx-auto flex min-h-20 max-w-6xl flex-wrap items-center justify-between gap-3 py-3 px-4 md:px-6">
            <Link href="/" className="t-h6 flex items-center gap-2.5" aria-label="Content Machine, home">
              <LogoMark size={32} />
              <span aria-hidden>Content Machine</span>
            </Link>
            <NavLinks />
          </nav>
        </header>
        <Suspense fallback={null}>
          <WorkerBanner />
        </Suspense>
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">{children}</main>
      </body>
    </html>
  );
}
