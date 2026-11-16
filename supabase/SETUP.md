# Supabase setup

1. Run `supabase/migrations/202611160001_ryvo_foundation.sql` in your project's SQL Editor. Its verification query must return five tables with row security enabled. Running it again preserves account data.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel's Production and Preview environment settings, using the public project URL and anon key you supplied. Redeploy after saving. The local `.env.local` is intentionally excluded from Git.
3. In Supabase Authentication → URL Configuration, set the Site URL to `https://ryvo2.vercel.app` and allow `https://ryvo2.vercel.app/signin` (plus localhost sign-in URLs for local development). Keep email confirmation enabled. Configure your email sender before inviting many users.
4. Register an account, confirm its email, then sign in. Verify an empty wallet is created. Browser-only accounts and balances are intentionally not imported.

## What is connected

Supabase email/password authentication, email confirmation, sign-out, profile metadata editing, and protected reads of wallets, transactions, player boards, published competitions and community token distribution. The app never accepts the old caller-supplied wallet snapshot endpoint.

## Before accepting money

The first migration is an account/data foundation. The second migration below adds manually verified P2P funding and wholesale stock purchases. Swaps, withdrawals, competition publishing/payment, paid registration, draws, listings, referral settlement, winner settlement and token awards remain unavailable.

Implement verified payment webhooks and transactional server-side game operations before enabling these actions. All wallet changes, ledger entries, inventory transfers and token awards must be atomic and idempotent. The anon key must never be given write access to balances. Never place a service-role key in the browser or Git.

No blockchain token has been launched. The token page describes the planned programme; the database distribution counter starts at zero.

## Merchant studio and admin control room

1. Run `supabase/migrations/202611160002_merchant_admin.sql` after the foundation script. Trading starts disabled; no sample merchants or balances are inserted.
2. Sign up and confirm the account you want to use as the administrator. In the SQL Editor, replace the email below with that account's email and run:

```sql
insert into public.ryvo_staff(user_id, role)
select id, 'admin' from auth.users
where lower(email) = lower('YOUR_ADMIN_EMAIL')
on conflict (user_id) do nothing;
```

Verify the insert affected one account, or that the account already has a staff row. Admin status is read from this protected table, never editable user metadata. Do not make the staff table writable from the browser.

3. Open `/admin`, sign in, then visit Settings. Enter the actual treasury bank details and your chosen wholesale rate. Enable manual transfers only when the team is ready to verify receipts.
4. Merchants sign in at `/merchant` and submit their business/bank details. Review and approve them in `/admin/merchants`.
5. Approved merchants request stock at `/merchant/stock`. Each request locks its rate, amount and treasury bank details. After the transfer reaches the treasury, an admin verifies the exact amount and unique bank reference in `/admin/stock`. Only then is inventory added.
6. Merchants set their rate, limits and availability at `/merchant/offer`. Approved online merchants with enough stock appear in `/wallet/p2p`.
7. Players create an order before transferring. Credits are reserved, and the bank details are fixed on that order. The player reports payment within 15 minutes; the merchant checks the actual bank receipt, enters its unique reference and releases credits. The player's wallet and transaction history update atomically.

Do not release credits based solely on a screenshot or the player's report. Check the bank account. Bank transfers happen outside Ryvo; these actions record a human verification and do not initiate a bank transfer.

Unpaid orders can be cancelled to return reserved stock. Reported transfers require escalation before cancellation. Admins must resolve disputed payments and any bank refund externally before cancelling; Ryvo does not send the refund. Expired unpaid orders stay visible and reserved until cancelled or escalated, so late bank transfers can be reviewed safely.

Every mutation records an audit event. Receipt references are unique across wholesale and player funding. Repeating an already completed release does not add credit again. There is no manual balance editor.

Workspaces refresh every 15 seconds while visible. Lists show their latest 200 orders/audit events and up to 500 player/merchant/competition records. These are operational views, not full accounting exports. Merchant bank details cannot be changed through the offer editor; existing order details stay fixed.

Run `npm run test:operations` from `web` for isolated PostgreSQL tests of permissions, receipts, reservations, repeat requests, cancellations and settlement. No live account or payment is created by these tests.
