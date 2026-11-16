# Supabase setup

1. Run `supabase/migrations/202611160001_ryvo_foundation.sql` in your project's SQL Editor. Its verification query must return five tables with row security enabled. Running it again preserves account data.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel's Production and Preview environment settings, using the public project URL and anon key you supplied. Redeploy after saving. The local `.env.local` is intentionally excluded from Git.
3. In Supabase Authentication → URL Configuration, set the Site URL to `https://ryvo2.vercel.app` and allow `https://ryvo2.vercel.app/signin` (plus localhost sign-in URLs for local development). Keep email confirmation enabled. Configure your email sender before inviting many users.
4. Register an account, confirm its email, then sign in. Verify an empty wallet is created. Browser-only accounts and balances are intentionally not imported.

## What is connected

Supabase email/password authentication, email confirmation, sign-out, profile metadata editing, and protected reads of wallets, transactions, player boards, published competitions and community token distribution. The app never accepts the old caller-supplied wallet snapshot endpoint.

## Before accepting money

This migration is an account/data foundation, not a payment integration or the full game engine. Funding, bank verification, swaps, withdrawals, competition publishing, paid registration, draws, listings, referrals, winner settlement and token awards remain unavailable. No payment can complete or balance increase from a browser action.

Implement verified payment webhooks and transactional server-side game operations before enabling these actions. All wallet changes, ledger entries, inventory transfers and token awards must be atomic and idempotent. The anon key must never be given write access to balances. Never place a service-role key in the browser or Git.

No blockchain token has been launched. The token page describes the planned programme; the database distribution counter starts at zero.
