# Ryvo

## Platform and stack
Responsive web application using Next.js App Router, React, TypeScript and Supabase Auth/Postgres. The merchant and admin areas share this stack with the player application.

## Product and users
Players join artwork competitions, collect fragments and race to complete their boards. Merchants buy RYVO Credit inventory from Ryvo and resell it to players through P2P. Administrators approve merchants, review operations and manage the platform. RYVO Credit, dollar (USDC) earnings and pre-launch RYVO Token are separate balances. Players see prices in US dollars; P2P merchants quote their local currency.

## Confirmed constraints
Use the supplied Ryvo logo, Montserrat and established black, green, pink and purple visual system. Use custom dropdowns. Keep access and money decisions in the database, never in editable browser state. Restore previously used decorative/banner artwork outside competition cards without inventing competitions or balances.

## Release boundaries
Supabase setup is applied manually through versioned SQL scripts. Admin access is assigned only through the SQL Editor. No public form can grant administrative access. Automatic bank payments, withdrawals and the full competition engine are not yet connected. The user confirmed manual bank-transfer verification for the first merchant release. Manual settlement remains disabled until an admin configures the treasury details, wholesale rate and trading switch.
