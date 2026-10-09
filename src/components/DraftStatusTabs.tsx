"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export function DraftStatusTabs({ active, children }: { active: string; children: ReactNode }) {
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const measure = () => {
      const selected = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!selected) return;
      nav.style.setProperty("--tab-left", `${selected.offsetLeft}px`);
      nav.style.setProperty("--tab-width", `${selected.getBoundingClientRect().width}px`);
      nav.dataset.ready = "true";
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    nav.querySelectorAll("a").forEach((link) => observer.observe(link));
    return () => observer.disconnect();
  }, [active, children]);

  return (
    <nav ref={navRef} className="board-tabs" aria-label="Draft status">
      {children}
      <span className="board-tab-indicator" aria-hidden="true" />
    </nav>
  );
}
