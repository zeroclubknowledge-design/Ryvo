# Ryvo

A working Next.js demo application following the supplied dark, acid-yellow and purple reference.

## Run

From `web`, run `npm run dev` and open http://localhost:3000. `npm run build` creates a production build; `npm start` serves it.

## Implemented

- A rounded Collectible / My board switch links `/collection/[id]` (overview and competition rules) to `/board/[id]` (large interactive board, collection marketplace, and demo leaderboard).
- Wallet redesign with a purple balance card, Fund, Withdraw, Bank account, and Activity actions.
- `/wallet/p2p` provides searchable demo merchant offers, rate/limit comparison, quote review, and idempotent funding confirmation.
- Test bank accounts and withdrawals from a separate sample earnings balance, with a persisted two-minute simulated payout and status history.
- Hidden scrollbars with normal scrolling preserved.
- Responsive discovery with collection details, category and creator search, sorting, and saved collections.
- Individual boards showing owned and missing artwork fragments.
- Every browser-based demo account starts with ₦100,000 in simulated naira.
- Entry deducts the naira fee, creates a board with one piece, and credits 10 RYVO per naira of entry value.
- Demo marketplace purchases debit cash and update piece ownership and the ledger together.
- Distinct RYVO, demo spending money, withdrawable demo earnings, and Universal Piece balances, plus dated transaction history.
- Server-side validation rejects duplicate entries, duplicate purchases, invalid pieces, and insufficient funds. Demo operations are stateless and never write to the deployment filesystem. Wallet snapshots are saved in browser local storage; Web Locks serialize same-origin payments across browser tabs where supported.
- Direct routes for boards, marketplace, wallet, referrals and individual boards.

## Development boundary

This demo uses a separate wallet per browser profile, not authenticated user accounts. The starting ₦100,000 is simulated spending money and cannot be withdrawn. A separate ₦7,500 sample earnings balance is issued once so the withdrawal flow can be tested. Existing browser wallets are migrated without resetting their collections or spending balances. Wallets persist across refreshes and navigation in the same browser; clearing site storage or using another browser creates a fresh demo account. There is no cross-device sync.

The stateless `/api/demo` endpoint validates an incoming test snapshot and returns its updated state, so it works on read-only serverless hosts without `.data` or `/tmp` writes. Browser-owned snapshots are editable test data and must never authorize real payments. Real accounts require authenticated database-backed ledgers.

Merchants, wholesale/retail rates, trade metrics and leaderboard collectors are sample data. Real merchant registration, wholesale credit inventory, bank verification, transfer confirmation, escrow/disputes, and payout-provider integration remain to be implemented. Funding simulates paying demo naira for merchant-priced RYVO. Withdrawals reserve only sample earnings and mark the test payout complete after two minutes; no bank receives funds. Test bank details are stored only in this browser wallet.

Before launch, replace the demo API with authenticated user-scoped services backed by a transactional database. Implement confirmed payment webhooks, provider-level idempotency, unique collectible-copy records, seller listings and proceeds, winner validation, lifecycle jobs, refunds, creator/admin tools and operational audits. The demo does not collect real payments, execute payouts, award winners, or transfer real seller-owned assets. Marketplace listings and fees are illustrative; the fee is displayed but no seller settlement is simulated.

Universal activation and referral qualification are deferred because the supplied PRD explicitly leaves their rules undecided. The final selection/consumption policy, fee rounding, payout holds, winner ties, timing and conversion rules must be agreed before implementing financial behavior. Current prices, artists, artwork and collection figures are sample content.

## Artwork

`public/other-side.png` was created with the built-in image-generation tool. Prompt: a premium 3D collectible explorer in matte black technical hooded streetwear, glossy dark chrome visor, acid-lime lighting, smoky olive studio backdrop, subject on the right with negative space at left; no text or watermark. Supporting sculptures are native CSS illustrations.

## Verification

Production build and TypeScript checks; browser checks for desktop and mobile layouts and the entry/collection flow. Run `npm run test:demo` for repeatable API checks of initial funding, naira payments, RYVO credits, duplicates, insufficient funds, account isolation, wallet migration, merchant funding, duplicate orders, bank validation, withdrawal limits/statuses and route availability. Tests use independent snapshots and do not change any browser wallet.
