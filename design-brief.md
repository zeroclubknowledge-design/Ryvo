# Ryvo — Design Brief

Handoff for Phase 3 (UI). Self-contained: everything the UI phase needs. · 13 November 2026
Deeper context: [`requirements.md`](./requirements.md) · [`ux-brief.md`](./ux-brief.md)

## Product

Ryvo is a competition-based digital collectibles platform. A creator splits an artwork into 10–50 unique pieces and opens a competition. A participant pays an entry fee in ₦, receives one competition piece and RYVO credit immediately, then acquires the remaining pieces to fill a personal board. The first participants to complete, up to the creator-configured winner count, close the competition early. This version covers the **participant loop plus the wallet**: browse, enter, receive, build, complete, and the balances that make those actions legible. Marketplace, creator tooling, admin and referrals are out.

**Problem statement.** A set-completion collector needs a way to finish a set they have started, because assembling artwork piece by piece across scattered marketplaces means the last few pieces either never appear or appear at prices that make finishing irrational — so they abandon sets with real money already sunk.

## User and context

22–40, already collects sets (cards, stickers, digital). Evening laptop sessions at 1280–1440, occasional phone checks. Marketplace-literate, not crypto-native. Wants to know exactly what's missing, whether the board is still winnable, and what the money does. Fears spending into a dead end; fears paying into rules they don't understand. Trust is fragile at two moments: right after paying, and right before spending again on a stalled board.

## Chosen concept

**Completion Board, with an advisor line and one live race figure.**

**Mental model:** the product is a workbook holding the boards you're finishing; competitions are the doors you came through. The board is home. Progress and the gap come before anything else.

- The **race survives only as** winner slots remaining and time remaining. No standings, no competitor identities, no ranking of individuals.
- The **advisor survives only as** one arithmetic sentence in the gap panel: missing count · cheapest complete route · how many are listed now. It states numbers; it never recommends.
- Rejected: pure Live Race (countdown at the centre = casino read, needs others' positions) and pure Advisor (cannot render 50 pieces, hides inventory, patronising at day 100).

## Core jobs (ranked)

1. See the gap and close it.
2. Enter with confidence.
3. Know if I can still win.
4. See what it's worth.
5. Recover from a dead board.

## Condensed flows

**J1 Close the gap.** My Boards → board (progress, grid, advisor line) → missing slot (supply, listings, cheapest price) → route: buy / activate Universal Piece / notify-me → confirm → board updates. *Stalled:* 0 listed → advisor line says the cheapest route is unavailable → exits are Universal Piece or notify-me, with a date.

**J2 Enter.** Queue (one live join) → competition detail → pay → **confirming** (receipt, nothing granted) → provider confirms → board created with one piece and RYVO credited. *Declined:* plain failure, nothing charged. *Filled while paying:* closed state, nothing charged. *Duplicate webhook:* one board, one piece, one credit.

**J3 Winnability.** Board carries winners remaining, time remaining, pieces missing, cheapest route cost. Participant does the arithmetic.

**J4 Worth.** Wallet: RYVO with a not-cash statement, then cash pending / available / held kept separate, then pieces, Universal Pieces, history.

**J5 Dead board.** Grace period → advisory states plainly the board won't complete → Universal Piece for one gap, or conversion at close → at close, conversion or refund notice with the ₦ figure.

## Navigation

**Global:** My Boards · Competitions · Wallet. Utilities: notifications, account.
**Contextual:** competition detail (from the queue or a board), entry → confirming → receipt, missing slot, activation, result.

```
My Boards ─┬─ Board (hero) ─┬─ Missing slot
           │                ├─ Activate Universal Piece
           │                └─ Result / closure
Competitions ─ Competition detail ─ Entry ─ Confirming/Receipt
Wallet ─ Ledger entry · Verification (dormant)
Notifications · Account
```

## Screen inventory (journey order)

| # | Screen | Primary action | Content priority | Type |
|---|---|---|---|---|
| S1 | **My Boards** | Open the board needing attention | Progress per board → missing pieces → winners and time left → queue strip | Key |
| S2 | **Competition queue** | Join the open competition | Live competition with fee and winners → ordered upcoming → active and closed | Supporting |
| S3 | **Competition detail** | Enter for ₦X | Artwork → what you receive → fee and credit arithmetic → winners and capacity → closure, refund, conversion rules → timeline | Key |
| S4 | **Entry** | Pay ₦X | Amount → credit received → what happens next → payment method → KYC note (not needed until withdrawal) | Key |
| S5 | **Confirming / receipt** | View receipt | Paid → what will arrive → expected timing → reference | Key |
| S6 | **Board** | Act on the recommended route | Progress and gap → full grid → advisor line → winners and time → routes → acquisition history | **Hero** |
| S7 | **Missing slot** | Choose buy, activate or notify | Supply count → listings and prices → activation availability → notify-me | Supporting |
| S8 | **Activate Universal Piece** | Activate | Rule (one per competition) → that Ryvo selects the piece → what you'd receive → confirm | Key |
| S9 | **Result / closure** | View allocation, or return to boards | Outcome → ₦ allocation or refund → when → why it closed now | Key |
| S10 | **Wallet** | Open a ledger entry | RYVO + not-cash statement → cash pending/available/held → pieces → Universal Pieces → history | Key |
| S11 | **Ledger entry** | Read-only | Amount and direction → reason → date → reference → affected board | Supporting |
| S12 | **Notifications** | Open the affected screen | Closing soon → closed → converted → credited | Supporting |

## Hero screen to design first

**S6 · Board.** It carries three of five core jobs, holds the only stall state, must hold 10, 25 and 50 pieces without collapsing, and forces the visual language to be decided honestly: a grid of authored slots, one live competition figure, one advisory sentence, one accent doing all the shouting.

States: in progress · all-but-one · complete · stalled (zero supply) · grace period · closed-converted · closed-refunded · 50-piece density · loading.

## UX principles

1. **The gap is the product.** Every screen answers "what's missing" first.
2. **Value appears only after the server confirms it.** No optimistic credits or provisional pieces.
3. **Arithmetic, not adjectives.** "9 of 12 · 3 missing · ₦2,400 · 0 listed", never "almost there!".
4. **One shouting element per screen.** Competition state is the only thing allowed to be loud.
5. **Honest dead ends.** When a board can't be finished, say so and show the way out.

**Voice.** Second person, numbers before nouns, state rather than feeling. No exclamation marks, no "hurry", no urgency verbs. A refusal names the rule and the remedy in the same sentence.

## Brand and tone

- **Personality:** confident, precise, plain-spoken, kinetic, tactile.
- **Must never feel:** a casino (no countdown dread, no "one more try"), a crypto trading terminal (no floor/bid/mint/ETH, no candlestick decoration), a mobile game (no gacha theatrics, no reward showers), a corporate bank (no compliance furniture instead of product design).
- **References liked:** **Happn** — one subject, one decision, bold condensed statement type, black pill action, generous void. **GlooNFT** — type-as-hierarchy, poster numerals. **Azuki** — the stats strip as a pattern for capacity, winners left, fee, time. **CloneX / Lakers fan-out** — completion-state idioms: ghosted siblings, `x3` ownership bubbles.
- **References disliked:** NFT marketplace vocabulary and aura; glassmorphism and aurora blobs (destroy contrast on money figures); fixed 3D mascot art (competes with creator artwork, ages badly).
- **Surface stance:** light canvas, near-black type, **one high-voltage accent reserved for live competition state**. Dark surfaces only where a piece or artwork demands it.
- **Competitors:** OpenSea, Blur, CloneX-adjacent marketplaces, raffle and break sites, NBA Top Shot, Sorare.
- **No existing brand assets.** Wordmark and identity are greenfield; Phase 3 sets them.

| Use | Never use |
|---|---|
| listing price | floor price |
| offer | bid |
| issued | minted |
| balance | wallet (for RYVO) |
| piece | token, NFT (in participant copy) |
| entry fee | buy-in, stake |
| winners remaining | spots left |

## Platform and accessibility

- Web app; **desktop-first at 1280+**, usable at 768 and 390.
- ₦ integers, `en-NG` formatting; RYVO integers with thousands separators. English only.
- AA contrast, complete keyboard path, board state never conveyed by colour alone (owned vs missing must differ in shape, weight or label too).
- The 50-piece grid is the density ceiling; design it, don't stretch the 12-piece case.
- Dark surfaces are exceptional, not a mode.

## Must have vs won't have

**Must:** ordered queue with one live join · competition detail with rules · explicit confirming state · board as a physical set grid from 10–50 · supply reality for missing pieces · wallet with split balances and history · Universal Piece activation limited to one per competition · winner proximity and completion · closed/cancelled/refunded reachable from every live surface.

**Won't:** marketplace listing/buying/selling · creator tooling · admin · referral UI · free claims allocation · real payments, backend, auth or artwork processing · email/SMS · localization.

## States to design

First-run empty board · stalled board with zero supply · completed board · competition nearly full · competition full · competition closed mid-flow · payment declined · payment delayed · duplicate webhook suppressed · 50-piece density · empty ledger · pending holds · listing sold mid-flow.

## Open decisions that could change UI

1. **Capacity clock.** A competition that never fills has no clock start; no admin UI exists to set a deadline.
2. **Supply panel depends on a marketplace v1 doesn't build.** Listing counts and prices shown in S6/S7 need real listings to be true.
3. Winner-position disclosure is unspecified — the brief assumes slots remaining only.
4. Referral rewards are invisible in v1.
5. Free claims (10% allocation) parked, no UI.
