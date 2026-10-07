"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Drafts", match: (p: string) => p === "/" || p.startsWith("/drafts") },
  { href: "/settings", label: "Settings", match: (p: string) => p.startsWith("/settings") },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="flex items-stretch gap-6 self-stretch">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`t-small flex items-center border-b-2 font-semibold transition-colors ${
              active ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
