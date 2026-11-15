# Ryvo product design

Ryvo is a collectible board game. Players join competitions, collect and trade pieces, and race to complete their board. The app serves repeat play; the landing page introduces the game.

## Established identity

- Use the supplied Ryvo logo and self-hosted Montserrat throughout.
- Keep the charcoal canvas, lime/green actions, and pink/purple creator accent. Create is neutral until selected.
- Artwork leads discovery. Preserve the tilted landing artwork and moving ribbon requested by the user.
- Use floating app navigation. Sidebar navigation belongs to the landing pages.
- Avoid decorative rules, underlines, invented statistics, fake reviews, and ornamental dashboard charts.

## Product interface

- Explore is a play room: a large featured artwork, a real board-in-progress preview, and a pink creator panel. It must feel like a place to play rather than a generic dashboard.
- Featured artwork carries the competition title, real entry cost, piece count, and winner availability. The continue-playing preview uses the player's actual owned fragments.
- Challenge titles sit on their artwork covers; supporting facts remain below. Keep the art dominant.
- Desktop player profiles place identity beside a collection gallery. Mobile stacks the cover, identity and gallery without changing their meaning.
- Wallet credit and withdrawable earnings stay visually distinct, using pink and green surfaces. Bank and merchant controls form a secondary row; Universal Pieces sit in a separate ribbon.
- Challenge cards show actual status, naira entry cost, winner availability, and registration progress or remaining time.
- On phones, discovery uses one readable card per row. Tablet uses two columns; desktop uses four.
- Align content edges. Group related facts and separate distinct tasks with space.
- Use readable secondary text, tabular numbers for balances, and comfortable touch targets.
- Support keyboard navigation, visible focus, labelled icon buttons, and recovery from empty/search states.
- Give frequently used controls brief press feedback. Gate hover effects to fine pointers; respect reduced motion. Avoid scroll reveals and page-wide entrance delays.
- Financial actions retain explicit demo labels and existing validation. Visual refinement does not turn browser-local storage into a production backend.

## Verification

Verify discovery, collection, boards, wallet, creator entry, and account pages at phone, tablet, and desktop sizes. Include long text, search with no results, a new player with no boards, keyboard focus, and reduced motion. Build and demo regression checks must pass before publishing.

## Piece economy

Registration uses naira and issues 10 r/ per ₦1. New boards start empty. Draws, gift redemption and trading stay locked until registration fills. Each type has one copy per player place; random draws can repeat types. Show physical copy quantities separately from unique board progress. Listing removes one copy, and the board slot remains filled when another copy is owned. Player listings use RYVO; seller proceeds and simulated prizes enter naira earnings. Keep demo boundaries explicit.
