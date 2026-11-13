# Ryvo

A working local Next.js application following the supplied dark, acid-yellow and purple reference.

## Run

From `web`, run `npm run dev` and open http://localhost:3000. `npm run build` creates a production build; `npm start` serves it.

## Implemented

- Dedicated `/collection/[id]` pages with artwork, creator details, board progress, collection rules, and shareable URLs.
- Hidden scrollbars with normal scrolling preserved.
- Responsive discovery with collection details, category and creator search, sorting, and saved collections.
- Individual boards showing owned and missing artwork fragments.
- Demo entry creates a board with one piece and credits 10 RYVO per naira of entry value.
- Demo marketplace purchases debit cash and update piece ownership and the ledger together.
- Distinct RYVO, demo cash, and Universal Piece balances, plus dated transaction history.
- Server-side validation rejects duplicate entries, duplicate purchases, invalid pieces, and insufficient funds. Writes are serialized within one process and stored atomically in `.data/demo.json`.
- Direct routes for boards, marketplace, wallet, referrals and individual boards.

## Development boundary

This is a local development foundation using one shared seeded demo account. It is not a production financial service. Do not expose `/api/demo` publicly. The file store and process-local queue are for a single local server only; they do not provide multi-process or distributed transaction safety.

Before launch, replace the demo API with authenticated user-scoped services backed by a transactional database. Implement confirmed payment webhooks, provider-level idempotency, unique collectible-copy records, seller listings and proceeds, winner validation, lifecycle jobs, refunds, creator/admin tools and operational audits. The demo does not collect real payments, execute payouts, award winners, or transfer real seller-owned assets. Marketplace listings and fees are illustrative; the fee is displayed but no seller settlement is simulated.

Universal activation and referral qualification are deferred because the supplied PRD explicitly leaves their rules undecided. The final selection/consumption policy, fee rounding, payout holds, winner ties, timing and conversion rules must be agreed before implementing financial behavior. Current prices, artists, artwork and collection figures are sample content.

## Artwork

`public/other-side.png` was created with the built-in image-generation tool. Prompt: a premium 3D collectible explorer in matte black technical hooded streetwear, glossy dark chrome visor, acid-lime lighting, smoky olive studio backdrop, subject on the right with negative space at left; no text or watermark. Supporting sculptures are native CSS illustrations.

## Verification

Production build and TypeScript checks; browser checks for desktop and mobile layouts and the entry/collection flow. See `scripts/check-demo.mjs` for repeatable, non-mutating API checks.
