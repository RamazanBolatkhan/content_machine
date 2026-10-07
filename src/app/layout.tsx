import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { aiConfigured, aiSetupHint } from "@/lib/ai";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Content Machine",
  description: "Turn X bookmarks and gaming news into Russian Threads posts",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const aiProblem = aiConfigured() ? null : aiSetupHint();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen font-sans">
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold">
              🎮 Content Machine
            </Link>
            <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              Drafts
            </Link>
            <Link href="/settings" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              Settings
            </Link>
          </nav>
        </header>
        {aiProblem && (
          <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {aiProblem}. See <code>.env.example</code>.
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
