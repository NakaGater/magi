"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "TASK" },
  { href: "/specs", label: "SPECS" },
  { href: "/history", label: "LOG" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-wider text-accent uppercase font-mono magi-glow">
            MAGI
          </span>
          <span className="text-xs text-text-dim hidden sm:inline font-mono uppercase tracking-wider">
            SYSTEM v2.5
          </span>
        </Link>

        <nav className="flex gap-1">
          {NAV_ITEMS.map(({ href, label }) => {
            const isActive =
              href === "/"
                ? pathname === "/"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors ${
                  isActive
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "text-text-dim hover:text-accent hover:bg-surface-2/50 border border-transparent"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
