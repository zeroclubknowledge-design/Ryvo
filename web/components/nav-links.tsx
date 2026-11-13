"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS = [
  { href: "/", label: "My Boards" },
  { href: "/competitions", label: "Competitions" },
  { href: "/wallet", label: "Wallet" },
];

function navClass(active: boolean) {
  return active
    ? "rounded-full bg-ink px-3.5 py-1.5 text-paper"
    : "rounded-full px-3.5 py-1.5 text-ink-soft hover:bg-line-soft hover:text-ink";
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 text-[13.5px]">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={navClass(active)}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Same geometry as NavLinks, no route awareness — streams in behind Suspense. */
export function NavLinksFallback() {
  return (
    <nav className="flex items-center gap-1 text-[13.5px]">
      {NAV_ITEMS.map((item) => (
        <span key={item.href} className={navClass(false)}>
          {item.label}
        </span>
      ))}
    </nav>
  );
}
