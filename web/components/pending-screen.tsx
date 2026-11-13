import Link from "next/link";

type Props = {
  code: string;
  title: string;
  lead: string;
  items: string[];
};

/** A screen mapped in the brief but deliberately not built in this pass. */
export function PendingScreen({ code, title, lead, items }: Props) {
  return (
    <main className="mx-auto max-w-[1180px] px-6 py-12">
      <p className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">
        Screen {code} · mapped, not built
      </p>
      <h1 className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.025em]">
        {title}
      </h1>
      <p className="mt-3 max-w-[54ch] text-[14px] leading-relaxed text-ink-soft">
        {lead}
      </p>

      <ul className="mt-8 max-w-[64ch] divide-y divide-line-soft border-y border-line text-[13.5px]">
        {items.map((item) => (
          <li key={item} className="py-3">
            {item}
          </li>
        ))}
      </ul>

      <Link
        href="/"
        className="mt-8 inline-block rounded-full border border-line px-5 py-2.5 text-[13px] hover:border-ink"
      >
        Back to boards
      </Link>
    </main>
  );
}
