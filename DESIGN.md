# Ryvo design system

## Direction

Reference: https://fantrade.vercel.app, inspected on its landing, dashboard, exchange and wallet pages. Apply its black canvas, centered landing statement, bold Montserrat headings, compact product structure, neutral cards and pill controls to Ryvo. This supersedes the previous olive card-heavy play-room design.

Keep Ryvo’s supplied logo, Montserrat, green primary actions and purple selected Create state. Preserve all game mechanics and explicit demo boundaries. No Fantrade assets, football claims, prices or product functions are copied.

## Layout

- Landing: horizontal desktop navigation; mobile menu drawer with outside-tap dismissal. Centered hero, large game artwork, board/trading demonstrations, creator and referral panels, three-step rules and final start action.
- App: centered content with a 1,052px maximum width, compact header, and existing floating navigation with its fixed blur and safe-area treatment.
- Home: actual RYVO balance and creator panel next to the current open competition. Follow with real board progress, referrals, search/category filters and compact challenge rows.
- Challenge rows show readable titles, artwork thumbnails, creator, registration capacity, naira entry cost, issued credit and winner availability. All category, search, save and sort behavior remains functional.
- Wallet: open balance typography on the canvas, compact action controls, separate neutral earnings card and secondary bank/funding sections. Do not restore the removed demo-cash card.
- Collection details, boards, creator tools, referrals, account, onboarding and authentication use the same neutral surfaces and heading/control grammar.

## Tokens and typography

Canvas #050505; surface #111211; raised surface #191a19; foreground #f5f5f3; secondary text #a0a29e. Green #60b800 is the action and selected-nav accent. Purple #6338bc identifies selected Create; secondary creator surfaces use deep purple. Avoid full-card pink wallet fills.

Use Montserrat throughout, headings at 750–850 weight and tracking no tighter than -0.04em. App headings are compact, 30–44px; display statements use responsive uppercase type. Keep 20px phone gutters and 24px app gutters, with 16–24px related-item spacing. Cards use 18–22px corners and controls use pills. Separate groups with space; avoid decorative underlines and rules.

## Interaction and verification

Keep visible focus, labelled icon buttons, readable disabled reasons, keyboard tabs, empty/error states, and reduced-motion support. Hover changes are brief and gated to fine pointers. Mobile menu closes on outside tap and Escape. Navigation remains responsive and scrollable; fixed blur layers cannot intercept taps.

Build, demo regression checks and browser checks cover landing, mobile menu, discovery filters, collection-to-board navigation, piece actions, wallet controls and account entry. Check 390px, tablet and desktop widths, plus 320px for overflow. Preserve unrelated user edits when committing.

## Product rules

Register in dollars and receive 1,000 r/ per $1 (see Dollar pricing). Boards start empty; draws and trades unlock when capacity fills. A competition lasts one month. Supply equals capacity × piece types; random draws can duplicate. Listing moves one copy, and a unique slot stays filled if another copy remains owned. New player listings use RYVO; seller proceeds and simulated prizes enter naira earnings. Browser-local demo state does not authorize real payments.

## Loading feedback

Collection, board and app route fallbacks use the actual Ryvo logo centered on a dark ambient pink/green background. Ink fills pink left-to-right, charcoal right-to-left, then green left-to-right in a 720ms pass within a 1,080ms cycle. Use CSS clip-path animation with a static full logo for reduced motion. Announce a descriptive loading status to assistive technology without visible opening text. Use the optimized logo source, and keep non-collection navigation immediate. Collection and board entries now show a single 950ms opening overlay after the optimized logo is ready so the requested logo pass is visible even after prefetch; reduced-motion users skip that hold.

## Surface refinements

Product boxes and text inputs are borderless; focus uses tonal keyboard feedback, with no green ring around amount fields; selected digits use a muted purple highlight. P2P does not show demo-cash balances. How-to-play is a pill, the landing drawer has room after the logo and before Get started, and the guide playbook uses open rows. Notifications use a grouped, borderless feed with actual activity, read filters and reversible clearing saved per browser account.

## Dropdowns and back navigation

All product selects use the shared `RyvoSelect` component, built on Base UI. Use borderless dark rounded popup cards, a tonal selected row, green check mark, keyboard/typeahead support, Escape/outside-tap dismissal and viewport-aware placement. Inside native wallet dialogs, portal the menu into that dialog so it stays in the top layer. Never introduce a device-native visible select in player, merchant or future admin screens.

All back controls use a soft pink tint from Ryvo’s palette. Onboarding has one footer Back control beneath its primary action on each step; remove the duplicate above the progress indicator. Signup and signin also keep Back in the footer, below their form. Other app back controls keep their existing locations.

## RYVO Token and profile refinements

RYVO Token has its own public `/ryvo-token` page, linked below RYVO Credit. Keep Token separate from spendable Credit and naira. Supply is 10,000,000: 8,000,000 community and 2,000,000 team. A registered player’s signup ordinal sets their reward on each eligible winning collection: 1–1,000 = 100; 1,001–10,000 = 50; 10,001–100,000 = 10; 100,001–1,000,000 = 5; later = 1. Pay once per player/competition, including migration of recorded wins. Cap community awards at 8,000,000, reducing the final award when necessary. The glowing circular Launching soon control explains that milestone; never claim the demo has minted or launched a live token.

Wallet shows earned tokens, the player’s tier and community distribution progress. Counts are derived from browser-local demo award records and labelled accordingly. Production global signup ordering, distribution, minting and launch need shared authenticated services.

Landing drawer exit takes 380ms and delays visibility hiding until the slide completes. Demo buttons in its drawer, header and footer use pink. Profile has one Edit control by the avatar, compact icon badges under the username, and Log out in the banner menu. The lower View my boards action stands alone. Wallet and profile activity rows keep inset horizontal padding.

## Immediate creator registrations and prize pools

A paid creator launch opens its own registration immediately. Multiple competitions can register players at the same time. Previously queued records migrate to open registration without resetting payment or join counts. Each competition’s one-month play clock still starts only when its own capacity fills. No queue or next-registration handoff remains in the player/creator copy. Demo fill controls target an individual competition. Creation confirmation offers a copyable collection link, labelled as browser-local demo sharing.

The home creator panel uses the exact selected Create purple (#6338bc), with light text and a dark purple action. Featured art shows the full shared winner prize pool at top right; compact challenge rows show it beside View challenge. Amounts come from each competition’s prize field, not registration revenue or a made-up figure.

## Supabase transition

Public copy uses Start playing and removes browser-simulation claims. Hero: Your race to in soft Ryvo pink, Complete it in green. Supabase owns identity; published competitions, wallet balances, entries and boards come from protected database reads. Never import local prototype balances or progress into real accounts. Payment and game mutations stay unavailable until verified server operations exist. Missing data renders an explicit retry state, not a sample balance.

## Merchant and admin surfaces

Merchant studio lives at `/merchant`, with Orders, Credit stock and Your offer. The admin control room lives at `/admin`, with merchant approval, payment review, wholesale, competitions, players, audit and settings. Both are Operate surfaces inheriting the player design system: Montserrat, black canvas, neutral borderless panels, pink secondary banner actions, green merchant selection and purple admin selection. Desktop uses compact horizontal navigation; mobile uses a floating taskbar with a custom More menu for additional admin pages. No sidebar is introduced.

Use actual scoped Supabase records. Empty and inaccessible workspaces remain designed states, with no fictional transaction or revenue charts. Bank receipt confirmation has a distinct verification form and explicit amount/reference requirements. Stock and player credit balances remain separate.

Restore decorative artwork banners on player Explore, Boards, Wallet, P2P and Notifications with the existing explorer, bloom and chrome artwork. Keep competition data and competition cards independent of these banners. Share the SceneBanner component with operational entry and overview pages. Keep text sharp over a local dark artwork scrim, and blur only the fixed navigation backdrop.

## Player identity and stable loading

Profile uses a fixed-ratio shared cover rather than a personal banner. Covers live in `profile-media.ts`; additional supplied banners rotate by UTC day for every player, keeping the same geometry. Identity sits below the art, with an overlapping round photo, a pink upload control, one Edit action and a borderless custom logout menu. Players upload their own JPG/PNG/WebP photo to their account's Supabase Storage folder; never accept an arbitrary avatar URL.

Boards uses a prominent 36–48px `Boards` title. Explore's list heading is `Pick your` / `challenge` on exactly two lines. Footer How to play links use the pink pill treatment.

Load Montserrat through Next.js local fonts with preload and metric-adjusted fallback. Keep static page framing present while fetching data; do not replace the whole page with a short temporary loading panel. Banner entrances and navigation press scaling are removed. Data error messages float above the taskbar instead of pushing the layout down. Preserve the deliberately requested ink logo on collection/board openings.

## Premium surfaces

Three restrained material effects lift the product without changing its grammar. Liquid glass (`LiquidGlass`, after dashersw/liquid-glass-js) bakes a rounded-rect bezel height field into an SVG displacement map with slight RGB dispersion and applies it as a backdrop filter, so it refracts live content including WebGL artwork. It is used on the landing hero caption, the closing Explore pill and the app floating taskbar. Chromium refracts; other engines and reduced-transparency users get frosted glass.

The landing close is a stage: a slow brand water-plane gradient (the ruucm/shadergradient look, written as a react-three-fiber shader because the published bundle targets an older three.js and rewrites its global shader chunks) behind the Ryvo mark rendered in Paper's liquid-metal shader (paper-design/liquid-logo). Both load with next/dynamic and mount only while the section is near the viewport, so the page never holds the hero artwork context and the stage at once. Reduced motion freezes both; a static mark shows until the shader is ready.

## In-app chrome trims

Player, merchant and admin pages have no footer; the floating taskbar is the page end, and content keeps clear of it with bottom padding. Explore's heading stands alone (How to play lives in the banner action) and the balance appears only in the header, not as a separate RYVO Credit block. Create uses the same short heading grammar as Explore: `Launch.`

## Wallet (Solana)

Modelled on a wallet app's portfolio screen, in Ryvo's palette. The page opens on the balance card, with no artwork banner. Disconnected, the card shows a Ryvo avatar, "Not connected", the network chip, a "Connect a Solana wallet." headline and wallet rows (wallet icon, name, status, chevron). Android's mobile adapter shows a wallet glyph, labelled "Open my wallet app". Connected, the card shows an address-derived avatar, the wallet name with a copyable short address, a ⋮ menu (Receive, Copy address, View on Solscan, Disconnect), the BALANCE eyebrow and a dollar total of USDC plus SOL. An eye toggle hides every amount on the page and is remembered per browser. Long totals step down in size so they never overflow.

Below it: Move money rows (Add funds opens a Receive sheet with the full address and a network warning, Buy with P2P, and Swap and Fund RYVO Credit marked Soon), Your assets rows (RYVO Credit, USD Coin, Solana with their values), an Available to withdraw card (USDC earnings at 1 USDC = $1), the Token card, then Activity. Rows use #111211 on the canvas with tinted green, pink and purple icon tiles. On desktop, actions and assets sit side by side.

Balances come from `/api/solana/balances`, because Solana's public RPC rejects browser-origin requests with 403. The route reads public chain data server-side, with a 60-second SOL price from Jupiter. Set `SOLANA_RPC_URL` to a dedicated RPC for production traffic. Naira is retired from the wallet; old cash entries in Activity display in dollars.

## Dollar pricing

Players see US dollars everywhere except P2P merchant trades. RYVO Credit is 1,000 r/ per $1. Fees, prizes, earnings and listings are still stored in legacy naira units and shown in dollars at a fixed ₦100 = $1 (`money()` in `lib/demo.ts`), so every credit amount stays the same: a stored 1,000 is a $10 entry that issues 10,000 r/. Withdrawals are paid in USDC to the connected Solana wallet.

P2P merchants keep their local currency because players pay them by local bank transfer: merchant offers, orders, stock and wholesale quotes use `localMoney()` and read in naira. Old naira earnings cannot be cashed out as USDC (enforced in the cash-out migration).

## Installable app (PWA)

Ryvo is installable: `app/manifest.ts` (standalone, portrait, #050505, opens on Explore, shortcuts to Explore, Boards and Wallet), icons generated from the logo on the black canvas (192, 512, maskable 512, Apple touch 180), and `public/sw.js`. The service worker caches only hashed `/_next/static` files, fonts, icons and `offline.html`; pages always come from the network and fall back to the branded offline screen, and API, Supabase and Solana requests are never intercepted. Bump `VERSION` in `sw.js` when its caching rules change.

`PwaSetup` registers the worker in production and shows a dismissible "Get the Ryvo app" card (above the taskbar on app screens): Chrome, Edge and Samsung Internet use the native install prompt, which installs Ryvo as an Android app; iPhone Safari gets Share → Add to Home Screen instructions. Dismissal is remembered for 14 days per browser.

## Create and join with USDC

Create (`LiveCreate`) is a three-step flow beside a live board preview: Artwork (artwork upload, optional cover, title, story), Rules (10–50 pieces, players, winner slots, $5/$10/$20 entry, with a live launch-fee line) and Review (entry, projected entries, 20% prize pool, the creator's fixed 10% share, and an itemised launch fee). It ends with one "Pay $X & launch" button. Player and winner boxes are digit-only text fields that may be emptied while typing; they are checked on Continue.

The launch fee is set by the size of the game, never chosen by the creator: $1.00 base + $0.01 per player + $0.10 per winner slot + $0.0005 per piece in play (players × pieces), rounded up to the cent. For example, 2 players, 1 winner and 12 pieces cost $1.14; 200 players, 20 winners and 15 pieces cost $6.50; 10,000 players, 1,000 winners and 50 pieces cost $451. The formula lives in `web/lib/launch-fee.ts` and, identically, in `ryvo_prepare_competition_payment` (migration 202611190006). Signed-out creators see a sign-in gate. A paid launch opens registration immediately and appears under Your competitions. Artwork goes to the public `competition-art` Supabase bucket in the creator's own folder and renders through the `art:<path>` theme.

The collection page shows a join panel (`JoinCompetition`) with the entry price, the RYVO Credit it issues, places left and a fill meter. It then shows sign in, connect a wallet, or "Pay $X & join". After joining it shows "You're in" with Open your board. Closed or full competitions say so plainly.

Payments go to Ryvo's treasury (`BrPs45Ds…PSPU2`; override with `SOLANA_TREASURY_ADDRESS`). `/api/competitions/pay` works in three steps:
- **prepare:** the database validates and opens a 15-minute payment, and the server builds a USDC transfer with a one-off reference key. The wallet only signs.
- **submit:** the signed transaction must match exactly. The server sends it, confirms it, then records the launch or entry, issuing credits, the board and the place.
- **check:** recovers a missed confirmation by its reference.

A payment that lands after the last place is taken is kept as `refund_due` and never over-fills a competition. Filling the last place starts the one-month round. Run `supabase/migrations/202611190005_usdc_competitions.sql` in the SQL Editor; `npm run test:competitions` checks it in PGlite. The server also needs `SUPABASE_SERVICE_ROLE_KEY`.

Wallets reconnect automatically: the provider remembers the last approved wallet (`localStorage` key `ryvo-wallet`), and Disconnect clears it.

An unfinished launch is saved per account as you type (`ryvo-create-draft:<user>`: step, text, rules and uploaded artwork paths) for seven days, and restores when Create reopens. A launch that was paid while the app was in the background opens on its success screen. In the installed app, a relaunch at the start URL returns to the last in-app page visited within 30 minutes (`ryvo-resume`; sign-in and landing pages are never resumed).
One Solana connection serves the whole app: `SolanaProvider` wraps the root layout, so moving between pages never drops the wallet, and the picker shows "Reconnecting your wallet…" while the last approved wallet restores itself.

## Landing: money, wallet and Solana

The landing explains, in order: the hero (enter from $5, race to collect every piece, finish first and share the prize, paid in digital dollars on Solana) with a trust row; an At a glance strip ($5–$20 entry, 1,000 r/ per $1, one month, under 1¢ fees); "Real money. Real fast. Yours." with four plain points (USDC, seconds, sub-cent fees, your own wallet) beside a recommended-wallet card for Solflare with three set-up steps and the official solflare.com/download link; the play features; four start steps (get a wallet, pick a challenge, collect and trade, finish first); a seven-question FAQ; and the closing stage. Solana and Solflare are named and linked but their logos are never used: Ryvo is built on Solana and recommends Solflare, without claiming affiliation. FAQ copy stays honest about what is live: withdrawals to the wallet are "opening soon".

## Installed-app splash

In the installed app only, signed-in players see a splash: the Ryvo ink-pass logo (the same pink → charcoal → green animation as the loader) over a fluid background of slowly drifting, morphing pink, green and purple glows. It exits by surging the colour outward and opening from the centre into the app (700ms). It plays on a fresh launch (`SPLASH_BOOT` in `<head>` sets `html[data-splash]` before first paint, once per app session) for at least 1.7s and until the page has loaded, capped at 4s, and again on return after 10+ minutes away. Browser tabs, signed-out visitors and reloads within a session skip it. Reduced motion keeps the logo static and fades out.

## Competition economy

Every entry splits four ways (migration 202611190007, mirrored in `web/lib/economics.ts`):
- **Winners:** 10% + 30% × √(min(winners ÷ players, 50%) ÷ 50%), from 10% to 40%.
- **Creator:** 10%.
- **Ryvo:** 50%. Referral rewards are their rate as a percentage of this half.
- **Token launch pool:** the remainder, 40% minus the winners' share.

Each split is recorded in `ryvo_entry_splits`. Universal pieces can be converted to RYVO tokens, sold to Ryvo or listed in a joined competition's marketplace:
- **To tokens:** 1 token per piece while 24-hour conversions are at or below the admin target. Above it the rate is target ÷ conversions, with a floor of 0.1.
- **Sold to Ryvo:** at the admin USD price.
- **Listed:** bought with RYVO Credit; the seller gets USDC earnings at 1,000 r/ = $1, less 0.5%.

Admin → Economy shows the launch pool, the split, launch fees, refunds due, Universal activity and these settings. Tests: `npm run test:economy`.

## Referral tracking

Invite links (`/onboarding?ref=<username>`) are remembered on the device for 30 days, from any page, and the first invite wins. Sign-up sends the inviter as `referred_by`. The database links the new account to that player once, at creation (trigger `ryvo_link_referral`, migration 202611190008). Later edits can't move a referral, and self-referrals and unknown usernames are ignored.

Each paid entry by a referred player pays the referrer their rate × Ryvo's 50% share, straight to their USDC earnings, and is recorded on the entry's split. The rate follows the referrer's chosen programme: level from completed boards, or Ryvo's player count. A referral qualifies on the referred player's first paid entry, and every fifth qualifying referral issues a Universal piece. The Invite page shows Signed up, Qualifying and Earned from `ryvo_my_referrals`. Tests: `npm run test:referrals`. Sign-ups through the wallet alone don't carry an invite.
