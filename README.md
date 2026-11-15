# Ryvo

Ryvo is a digital collectibles competition app. This repository contains the working Next.js application, product requirements, and design briefs.

## Run the app

```sh
cd web
npm ci
npm run dev
```

Open http://localhost:3000.

```sh
npm run build
npm start
```

The demo includes collection discovery, dedicated boards with marketplace and demo leaderboard, simulated registration and purchases, a wallet dashboard in the logo’s brand colours, P2P merchant funding, test-bank accounts and simulated earnings withdrawals. Each browser-based demo account starts with ₦100,000 in simulated naira. Demo wallet state is saved in the browser, and payments do not write to the hosted app’s filesystem.

Read [the app notes](web/README.md) for implementation details, verification commands, artwork information, and the remaining production work. Real authentication, payments, payouts, official winner settlement and distributed persistence require production services.

## Project layout

- `web/` — application, public artwork, Montserrat font and licence.
- `requirements.md` — participant and wallet requirements.
- `ux-brief.md` and `design-brief.md` — experience and design references.
- `tools/serve.mjs` — optional local viewer for the project briefs.
