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

The local demo includes collection discovery, boards, simulated registration and purchases, and separate RYVO and cash balances. Demo account state is stored locally and excluded from Git.

Read [the app notes](web/README.md) for implementation details, verification commands, artwork information, and the remaining production work. Real authentication, payments, payouts, winner settlement and distributed persistence are not implemented yet.

## Project layout

- `web/` — application, public artwork, Montserrat font and licence.
- `requirements.md` — participant and wallet requirements.
- `ux-brief.md` and `design-brief.md` — experience and design references.
- `tools/serve.mjs` — optional local viewer for the project briefs.
