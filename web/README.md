# Ryvo app

A working Next.js demo of the collectible board game, using the supplied Ryvo logo and self-hosted Montserrat.

## Run and verify

From `web`, run `npm ci`, then `npm run dev`. For a production preview use `npm run build` and `npm start`. Run `npm run test:demo` against the preview; `RYVO_TEST_URL` defaults to http://localhost:3000. The rule tests require Node 24 native TypeScript support.

## Current game economy

- Register in naira. Every ₦1 paid grants 10 r/; a ₦1,000 registration grants 10,000 r/. New boards start empty. Each new demo account has ₦100,000 spending money.
- Collecting, Universal Piece redemption and trading unlock only when registration reaches capacity. Disabled actions explain this. Filling a competition starts its one-calendar-month clock and opens the next queued registration; there is no grace month.
- Supply is finite: each piece type has as many copies as player places. A 100-player, 20-type competition has 2,000 physical copies.
- Paid random draws use RYVO. The first full set's number of draws costs exactly the entry credit, with integer rounding distributed across draws. Twenty draws for a 10,000 r/ entry cost 500 r/ each. Draws can repeat types, so this does not guarantee completing a board in twenty draws.
- A gifted Universal Piece reveals one random copy without charging credit. Gifts and paid draws consume the same finite supply. Retry protection prevents double consumption.
- Pieces shows physical quantities and duplicates separately from unique board progress. List one copy for a chosen whole-credit price. Listing the last copy empties its slot; listing a duplicate leaves another owned copy on the board. Cancellation returns that copy.
- Marketplace offers are actual browser-local player listings. New offers use RYVO; historical naira offers remain compatible. Buying transfers one copy, including possible duplicates. Sellers receive naira earnings at 10 r/ per ₦1, minus the displayed 0.5% fee.
- First valid complete boards receive simulated naira prize shares once, up to the configured winner count. The leaderboard uses local player progress and recorded finishers. Sample competitions retain their existing reserved winner slots.
- Creator uploads support 10–50 fragments, launch-fee review, paid queue placement and a labelled demo registration-fill control.

## Product flows

Collection pages contain overview and competition rules; a rounded switch opens the board with Pieces, Marketplace and Leaderboard. The app has floating navigation, landing-only sidebar pages, onboarding and browser-local signup/signin. Wallet funding uses P2P merchants; Swap converts credits to withdrawable naira with a fixed 100 r/ fee. Bank accounts and two-minute withdrawals are simulated. Notifications, profile editing, referral guidance and transaction history are included.

## Demo boundary

Accounts, wallets, shared competition stock, listings and leaderboards persist within one browser origin. They do not synchronize across devices. Passwords use salted PBKDF2 hashes, but this is not production authentication. Artwork blobs use IndexedDB. Existing wallets migrate without resetting balances or collections.

The stateless `/api/demo` endpoint validates incoming snapshots and returns updated state. It never writes to a server filesystem. Browser-owned snapshots are editable demo data and cannot authorize real money. Atomic browser writes and Web Locks coordinate supported same-origin tabs.

No real money is charged, transferred or paid out. New accounts include a separate ₦7,500 sample earnings balance for withdrawal testing. Referral qualification/payout automation, expired-round refunds, real merchants and official winner validation still require production services. Before launch, use authenticated database transactions, unique copy records, payment webhooks, payout integration, fraud controls, lifecycle jobs and moderation.

## Artwork and verification

`public/other-side.png` is generated explorer artwork; supporting sculptures use CSS. Public font files include their licence.

Regression coverage includes naira registration, exact draw pricing, finite stock, duplicates, gift consumption, single-copy listing/cancellation, seller settlement, prize limits, account isolation, migration, queue timing, wallet funding, swaps, withdrawals and route availability. Browser checks also verify registration locks and a sale between two local demo accounts.
