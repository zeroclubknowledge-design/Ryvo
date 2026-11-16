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

Register in naira and receive 10 r/ per ₦1. Boards start empty; draws and trades unlock when capacity fills. A competition lasts one month. Supply equals capacity × piece types; random draws can duplicate. Listing moves one copy, and a unique slot stays filled if another copy remains owned. New player listings use RYVO; seller proceeds and simulated prizes enter naira earnings. Browser-local demo state does not authorize real payments.

## Loading feedback

Collection, board and app route fallbacks use the actual Ryvo logo centered on a dark ambient pink/green background. Ink fills pink left-to-right, charcoal right-to-left, then green left-to-right in a 720ms pass within a 1,080ms cycle. Use CSS clip-path animation with a static full logo for reduced motion. Announce a descriptive loading status to assistive technology without visible opening text. Use the optimized logo source, and keep non-collection navigation immediate. Collection and board entries now show a single 950ms opening overlay after the optimized logo is ready so the requested logo pass is visible even after prefetch; reduced-motion users skip that hold.

## Surface refinements

Product boxes and text inputs are borderless; focus uses tonal keyboard feedback, with no green ring around amount fields; selected digits use a muted purple highlight. P2P does not show demo-cash balances. How-to-play is a pill, the landing drawer has room after the logo and before Get started, and the guide playbook uses open rows. Notifications use a grouped, borderless feed with actual activity, read filters and reversible clearing saved per browser account.
