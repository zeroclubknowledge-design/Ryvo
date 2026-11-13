# Ryvo — Requirements

Phase 1 output · v1 participant surface · 13 November 2026
Source: `Ryvo_PRD_v3.0.pdf` (PRD v3.0) plus the Phase 1 interview.

## Summary

Ryvo is a competition-based digital collectibles platform. A creator splits an artwork into 10–50 unique pieces and opens a competition. A participant pays an entry fee in ₦, immediately receives one competition piece and RYVO credit, then acquires the remaining pieces to fill a personal board; the first participants to complete, up to the creator-configured winner count, close the competition early. This document scopes **v1 to the participant loop plus the wallet** — browse, enter, receive, build, complete, and the balances that make those actions legible. Marketplace trading, creator tooling and the admin back office are explicitly out of this version.

The design job: make a rules-heavy, money-heavy system feel legible and fair, and keep the collect-and-complete loop exciting without ever reading as a gamble.

## Problem framing

### Problem statement

A set-completion collector needs a way to finish a set they have started, because assembling artwork piece by piece across scattered marketplaces means the last few pieces either never appear or appear at prices that make finishing irrational — so they abandon sets with real money already sunk.

### Primary user snapshot

- **Who:** 22–40, already collects — physical cards, stickers, digital sets. Comfortable buying things online, fluent in marketplace mechanics, not crypto-native.
- **Context:** Evening sessions on a laptop, 1280–1440 wide, occasionally checking on a phone. Alert but cautious mood.
- **Jobs:** Know exactly what is missing; know whether the board is still winnable; understand what the money does.
- **Frustrations and worries:** Spending into a dead end. Paying into rules they don't fully understand. Not knowing whether the price they're seeing is fair. Being made to feel like they're gambling. Building something they cannot finish.

### Key scenarios

1. **The last three.** They join a competition, receive a piece instantly, need seven more — and three pieces are never listed by anyone. The board is at 9 of 12 when the grace period starts.
2. **The race.** Three winner slots remain, somebody is one piece away, and they must decide whether to spend before the competition closes.
3. **The pivot.** They use a Universal Piece to close a gap, and Ryvo — not they — chooses which piece appears.
4. **The windfall.** The competition closes early because the winner count was reached, and they are one of the winners; the allocation finally has to make sense in plain ₦.
5. **The stall decision.** The grace period is ending on an incomplete board and they must decide whether to keep waiting for conversion or stop spending.

### How might we

1. Make the exact gap feel like a solvable puzzle rather than a slot machine?
2. Show whether a board is still winnable, without talking the participant out of joining?
3. Make ₦ → RYVO → pieces → progress so legible that nobody mistakes RYVO for cash?
4. Let the race against other collectors land as competition, not as gambling?
5. Turn a stalled board into an honest wait instead of a dead end?

## Problem

Fragmented supply is the root problem, not price. Collectors can buy individual pieces endlessly, but completion — the moment the hobby pays off — depends on pieces other people choose to list. Ryvo's contribution is a structured board, a defined finish line, a finite winner set, and a cross-competition utility token (Universal Pieces) that gives a stalled collector a way out.

The secondary problem is comprehension. Entry fees convert to RYVO, boards have server-validated completion, winners close the competition early, and a no-winner outcome triggers refunds. Each of those is a place where a participant can misread the rules and feel cheated — even when the system behaved correctly.

## Goals and success metrics

Business goals, from PRD §3: creator launches, participant registrations, paid-entry completion, board completion and winner qualification, marketplace conversion, referral conversion, and clean financial reconciliation.

Participant-facing measures this design owns:

- **Board comprehension:** a participant can state what they're missing and what it would take to finish, without support contact.
- **Entry confidence:** zero fee- or rule-related support contacts in the first sessions after joining.
- **Stop-spending accuracy:** participants stop spending at the right moment — when a board is no longer winnable — rather than after.
- **RYVO comprehension:** no participant describes RYVO as withdrawable cash.

## Users

### Primary user

The set-completion collector described above. Every screen in v1 serves them.

### Secondary users

- **Buyer / seller.** Lists and buys eligible copies. Out of v1 UI; the wallet must still present proceeds correctly for when it arrives.
- **Competition creator.** Configures and launches. Out of v1 UI.
- **Referrer.** Shares a link, earns commission and Universal Pieces. Attribution and rewards exist server-side; **no referral UI in v1**.
- **Administrator.** Moderation, reconciliation, disputes. Out of v1 UI.

### Roles and permissions

v1 recognises one interactive role: an authenticated participant. They may view competitions, join an open competition, view their own board, activate a Universal Piece, and view their own balances and history. They may not view other participants' identities — only aggregate proximity (winner slots remaining, pieces still missing platform-wide).

### Context of use

Desktop-first, responsive down to mobile. Evening leisure sessions, often with a second tab open comparing listings. Trust is fragile at exactly two moments: immediately after paying, and immediately before spending again on a stalled board. Those two moments carry most of the design risk.

## Core jobs (ranked)

1. **See the gap and close it.** Always know which pieces are missing and the shortest honest path to a complete board.
2. **Enter with confidence.** Pick a competition and pay without doubting the fee, the rules or the credit that follows.
3. **Know if I can still win.** Feel whether the board can still reach winner status before spending again.
4. **See what it's worth.** Understand collection, RYVO credit and spend without doing the arithmetic themselves.
5. **Recover from a dead board.** Use a Universal Piece, wait for conversion, or understand why the entry refunds.

## Scope

### Must have

- Competition discovery as an **ordered queue**: all competitions visible with an explicit registration order; exactly one carries the live join action.
- Competition detail: artwork, fragment count, capacity, winner count, entry fee, rules, time remaining, winner slots remaining.
- Paid entry with an **explicit confirming state** — board and RYVO appear only after provider confirmation.
- Board: **physical set grid**, every slot rendered, owned lit and missing ghosted, at 10–50 pieces.
- Board supply reality: for missing pieces, how many exist, how many are listed, notify-me, and the Universal Piece route.
- Wallet: RYVO balance (integer, never cash), pieces owned, Universal Piece count, available / pending / held split, transaction history.
- Universal Piece activation: one per competition per participant, consumed on use, selection by Ryvo, atomic board update with the result shown.
- Winner proximity and completion state, including the "you were Nth of M" outcome and the allocation in ₦.
- Competition closed / cancelled / refunded states, reachable from any live surface.

### Should have

- In-app notifications for state changes (winner slots reached, competition closed, conversion applied).
- Grace-period countdown with an explicit "what happens next" explanation.
- Conversion notice when a stalled registration piece becomes a Universal Piece.

### Won't have (this version)

- Marketplace browsing, listing, buying, selling, proceeds.
- Creator competition creation and launch fee projection.
- Admin back office, moderation, disputes, reconciliation.
- Referral UI and referral rewards display.
- Free claims (the 10% allocation) — parked, accrues to a platform-held pool, no UI.
- Real payments, real backend, real auth, real artwork processing.
- Email and SMS notifications.
- Localization beyond English.

## Content and data

Mocked in v1, modelled on PRD §18.

- **Competition:** id, creator, artwork, fragment count, capacity, winner count, entry fee, lifecycle state, start/close dates, tier snapshot, winner slots remaining.
- **Participant:** id, competition, payment reference, registration status, board status.
- **CollectiblePiece:** id, artwork reference, fragment identity, type (competition | universal), owner, status.
- **ParticipantBoard:** required pieces, owned pieces, completion timestamp, missing set.
- **UniversalPiece:** id, owner, source/reason, status, activation history.
- **WalletLedgerEntry:** account, currency type (₦ | RYVO), amount, direction, reason, reference, timestamp.
- **Supply signal:** per missing fragment — owned by others, currently listed, typical listing price. Aggregates only, never identities.

Sensitive: payment references, identity verification state (withdrawal-only in v1), and every ledger entry. Financial history is immutable by definition; no screen may offer to edit or delete it.

## Platform and integrations

- **Web app:** Next.js App Router, TypeScript, Tailwind CSS, shadcn-style primitives.
- **Data:** typed mock layer with realistic fixtures, shaped so a real API can replace it without touching screens.
- **Auth:** mocked participant session.
- **Integrations deferred:** payment provider, KYC provider, payout provider, notifications transport.
- **Responsive:** desktop-first at 1280+, usable at 768 and 390.
- **No offline requirement.** Board and wallet must survive slow connections with visible pending states.

## Constraints

- No backend, no payment provider, no real money in this version.
- ₦ only, integers only for money and for RYVO; `en-NG` formatting.
- All competition truth is server-side by rule; the interface must never present a locally computed winner state as fact.
- Accessibility floor: PRD §17 — AA contrast, complete keyboard path, board state never communicated by colour alone.
- Artwork is mocked; no upload, moderation or fragmentation pipeline.

## Brand and tone

- **Personality:** confident, precise, plain-spoken, kinetic, tactile.
- **Must never feel:** a casino (no countdown dread, no "one more try" pressure), a crypto trading terminal (no floor/bid/mint/ETH vocabulary, no candlestick decoration), a mobile game (no gacha theatrics or reward showers), a corporate bank (no compliance furniture in place of product design).
- **References:**
  - *Liked:* **Happn** for restraint — one subject, one decision, bold condensed statement type, black pill action, generous void. **GlooNFT** for type-as-hierarchy and poster numerals. **Azuki** for the stats strip (volume/floor/listings/owners) as a pattern for capacity, winners left, fee, time. **CloneX / Lakers fan-out** for completion-state idioms — ghosted siblings, `x3` ownership bubbles.
  - *Disliked:* NFT marketplace vocabulary and aura. Glassmorphism and aurora blobs — category signature, and they destroy contrast on money figures. Fixed 3D mascot art — competes with creator artwork and ages badly.
- **Surface stance:** light canvas, near-black type, one high-voltage accent reserved for live competition state. Dark surfaces only where a piece or artwork demands it.
- **Competitors:** OpenSea / Blur / CloneX-adjacent marketplaces, raffle and break sites, NBA Top Shot, Sorare.

### Vocabulary guardrails

| Use | Never use |
|---|---|
| listing price | floor price |
| offer | bid |
| issued | minted |
| balance | wallet (for RYVO) |
| piece | token, NFT (in participant copy) |
| entry fee | buy-in, stake |
| winners remaining | spots left |

## Lifecycle

- **First run:** account, welcome Universal Piece granted, one clear next action — the competition currently accepting entries.
- **First competition:** entry, confirmation, first piece, board with an obvious gap and an obvious next step.
- **Returning:** queue position changed, board advanced, winner slots tightened, or a competition closed — the reason they came back must be on the first screen.
- **Stalled board:** explicit waiting state, supply count, Universal Piece route, and the conversion rule stated before it matters.
- **Closing:** result state — winner (with allocation), completed late, or refunded. Every close path explains what happened to their money.
- **Notifications:** in-app only in v1.
- **Deletion:** profile removed on request; ledger and ownership records persist because they are immutable.

## Edge cases and states

Every state below must exist as a designed screen state, not a fallback.

- **Board stall:** missing pieces with zero supply show counts, notify-me, and the Universal Piece route — never a bare ghosted slot.
- **Slow payment:** explicit confirming state with receipt and resolution expectation; no optimistic credit.
- **Payment failure:** plain-language failure, no partial registration, retry without double-charge risk.
- **Launch-day emptiness:** marketplace absent; boards empty; competitions are the front door. No fabricated liquidity.
- **KYC:** not required to browse, join or build; required only to withdraw cash. The requirement appears before it blocks, not after.
- **Competition closes mid-flow:** joining, buying or activating during closure is rejected with a plain "this competition has closed" state, never a silent failure.
- **Simultaneous winners:** server-committed order prevails; the outcome screen states the position and the published tie rule.
- **No-winner outcome:** refund state names the original entry, the amount, and the refund timeline.
- **50-piece density:** the grid must hold 10, 25 and 50 pieces without becoming a wall.
- **Duplicate webhook / repeated events:** no screen may show a doubled credit or duplicate board piece.
- **Empty ledger, new account, single competition.**

## Assumptions (signed off)

1. **A1** ₦ integer amounts, `en-NG` formatting; RYVO as plain integers with thousands separators.
2. **A2** English only; no localization layer.
3. **A3** In-app notifications only; no email or SMS in v1.
4. **A4** Artwork mocked; no upload, moderation or fragmentation pipeline in this build.
5. **A5** Actions attempted during closure are rejected with a plain closed state, never a silent failure.
6. **A6** Account deletion removes the profile; ledger and ownership records persist.
7. **A7** Accessibility floor is PRD §17: AA contrast, full keyboard path, never colour alone.
8. **A8** Winning is in scope: results and winner allocation belong to the loop.
9. **A9** Stack is Next.js App Router + TypeScript + Tailwind + shadcn-style primitives, mock data layer.
10. **A10** Scope is the participant surface end to end with mock data; no backend, no payment provider.

## Open questions

1. **Participant-facing success metric.** PRD §3 measures the business; nothing measures whether the participant understood their board. Proposed: self-reported "I know what I'm missing" at the stall state.
2. **Competition that never fills capacity.** The 30+30 clock needs a start; an admin-set registration deadline is assumed but no admin UI exists in v1. What happens to a competition sitting below capacity indefinitely?
3. **Does the winner state reveal other participants' positions?** Aggregates are agreed for supply; winner proximity is not yet specified.
4. **Free claims (10% allocation).** Parked. No claimant defined in PRD §13.
5. **Marketplace timing.** The wallet presents proceeds now, but the listing/buying surface is a v2 decision — and the board's supply panel depends on it existing.
6. **Referral qualification UI.** Attribution is server-side in v1, so a participant cannot see why they did or did not earn a referral reward.

## Decision log

| Decision | Options considered | Chosen | Why |
|---|---|---|---|
| First journey | Participant / creator / marketplace / admin | Participant loop + wallet | Highest volume, carries the core emotion and most PRD rules |
| Build target | Working app / prototype / system only / full build | Working web app, mock data | Reviewable and real without payments or backend risk |
| Platform | Desktop-first / mobile-first / both | Desktop-first responsive | 50-piece boards and money figures need width |
| Primary participant | Collectors / crypto-native / competition players / fans | Set-completion collectors | The board is a mechanic they already understand |
| Why they switch | Fragmented buying / raffles / collection games / nothing | Fragmented secondary buying | Ryvo's promise is finishing the set |
| v1 scope | Loop+wallet / loop / +marketplace / all but admin | Loop + wallet | Coherent slice; marketplace is trust-heavy and separable |
| Core job #1 | Gap / confidence / winnability / worth | See the gap, close it | Board must answer "what now?" unaided |
| Discovery model | Ordered queue / one open / catalogue+waitlist / line | Ordered queue | Honest to capacity sequencing, browse never dead-ends |
| Tone | Competitive / calm / playful / editorial | Confident, competitive | Matches the race mechanic |
| Never feel | Casino / trading terminal / mobile game / bank | A casino (primary) | The race must not read as a gamble |
| Reference family | Happn / GlooNFT / POUCH / COINZ | Happn restraint | One subject, one decision; strongest shield against casino read |
| Board model | Set grid / progress-first / gallery | Physical set grid | Makes the gap literal at 10–50 pieces |
| Surface stance | Light + accent / near-black / deep brand | Light canvas + one loud accent | Legible like a document, urgent only where it matters |
| Referral qualification | Registration / verification / first paid entry | First paid entry | Value must be real before it pays out |
| Referral commission | Every payment / first only | First qualifying payment | Bounded cost; protects §13 tier math |
| Universal Piece use | Consumed / reusable / limited | Consumed, single use | Scarcity stays legible |
| Universal Piece selection | User picks / random / cheapest missing | Missing piece with cheapest active listing; tie-break lowest piece ID; random with recorded seed if none listed | Deterministic, auditable, favours progress |
| Universal Piece limits | None / daily / per competition | One per competition per participant | Caps pay-to-complete |
| Simultaneous winners | Random / first by timestamp / admin | Server-committed order, transaction ID tie-break, published rule | Never a coin flip |
| RYVO precision | Fractions / integers | Integers only | Removes a reconciliation bug class |
| Launch fee basis | Capacity / actual revenue / estimate | Entry fee × full capacity, snapshotted | Number must move visibly before commitment |
| Marketplace fee base | Buyer pays / seller pays / split | 0.5% of item price off seller proceeds | Buyer pays the listed price |
| Seller proceeds | Instant / held / T+n | Available on confirmation, withdrawable T+7 or competition close | Matches required wallet states |
| Free claims | Include / define / park | Parked out of v1 | No claimant defined in PRD |
| Primary vs secondary revenue | Combined / separate | Separate; 0.5% is its own line | Prevents tier pollution |
| Piece conversion | Registration piece / all pieces / highest value | Registration-granted piece only | Blocks buying cheap closing pieces to mint utility |
| Competition timing | Calendar months / fixed days / relative | Fixed 30 + 30 from Active, UTC with local shown | "One month" is ambiguous; stalls otherwise never start |
| Currency | Naira / USD / neutral | Naira, ₦ | Symbol was lost in the PDF; the amounts are ₦ |
| KYC threshold | Signup / entry / withdrawal | Withdrawal only | Lowest friction into the loop, compliant at exit |
| Slow payment | Confirming state / optimistic / hard error | Explicit confirming state | Never show value that can vanish |
| Launch-day emptiness | Honest empty / gate / seed | Honest empty state | No fabricated liquidity |
| Board stall | Show supply / silent / Ryvo sells gap / declare | Show supply reality | Turns a dead end into a wait with an escape |
| Stack | Next.js / Vite / static / existing | Next.js + TS + Tailwind | Conventional, deployable, API-swappable |
