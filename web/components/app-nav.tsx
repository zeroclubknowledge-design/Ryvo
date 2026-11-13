import { Suspense } from "react";
import Link from "next/link";
import { NavLinks, NavLinksFallback } from "@/components/nav-links";
import { ryvo } from "@/lib/mock";

export function AppNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-8 px-6">
        <Link
          href="/"
          className="flex items-baseline gap-2 text-[15px] font-semibold tracking-[0.16em]"
        >
          RYVO
          <span className="hidden text-[10px] font-normal uppercase tracking-[0.18em] text-ink-soft sm:inline">
            collectibles
          </span>
        </Link>

        <Suspense fallback={<NavLinksFallback />}>
          <NavLinks />
        </Suspense>

        <div className="ml-auto flex items-center gap-3">
          <span className="tabular rounded-full border border-line px-3 py-1.5 text-[12.5px] text-ink-soft">
            {ryvo(18400)}
          </span>
          <span
            className="grid size-8 place-items-center rounded-full bg-ink text-[11px] font-medium text-paper"
            aria-hidden
          >
            AO
          </span>
        </div>
      </div>
    </header>
  );
}
