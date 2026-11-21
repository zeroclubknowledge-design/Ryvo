// Runs every migration in PGlite and checks the USDC/SOL P2P market.
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
 grant usage on schema auth,public,storage to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated;`);
const dir = new URL('../../supabase/migrations/', import.meta.url);
for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [admin, merchant, pending, buyer, other] = [1, 2, 3, 4, 5].map(uid);
for (const id of [admin, merchant, pending, buyer, other]) await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${id.slice(-1)}@example.invalid`]);
await db.query(`insert into public.ryvo_staff(user_id,role) values($1,'admin')`, [admin]);
await db.query(`insert into public.ryvo_merchants(user_id,name,status,bank_name,account_name,account_number) values($1,'Ada Exchange','approved','Ryvo Bank','Ada Ventures','0123456789'),($2,'Not yet','pending','Bank','Name','1234567890')`, [merchant, pending]);
const wallet = '9PnBeTXpx7rmAvYRu7jviQZSnMWJYNXegsknGdiR75mV';
const as = async (id, action, payload = {}) => { await db.exec('set role authenticated'); await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]); try { return (await db.query('select public.ryvo_p2p($1,$2::jsonb) as data', [action, JSON.stringify(payload)])).rows[0].data; } finally { await db.exec('reset role'); } };
const service = async (sql, params) => { await db.exec('set role service_role'); try { return (await db.query(sql, params)).rows[0]?.data; } finally { await db.exec('reset role'); } };

// Only approved merchants can post; the ad sells 100 USDC at ₦1,600 each.
await assert.rejects(() => as(pending, 'save-ad', { asset: 'USDC', currency: 'NGN', price: 160000, available: 100_000_000, min: 500000, max: 10000000 }), /approved merchants/);
const ad = await as(merchant, 'save-ad', { asset: 'USDC', currency: 'NGN', price: 160000, available: 100_000_000, min: 500000, max: 10000000, terms: 'Pay from an account in your name.' });
let market = await as(buyer, 'market', { asset: 'USDC', currency: 'NGN' });
assert.equal(market.length, 1); assert.equal(market[0].merchant, 'Ada Exchange'); assert.equal(market[0].account_number, undefined, 'The market never shows bank details');
assert.equal((await as(buyer, 'market', { asset: 'SOL', currency: 'NGN' })).length, 0);

// Buyer orders ₦16,000 → 10 USDC, reserved from the ad.
await assert.rejects(() => as(buyer, 'create-order', { adId: ad.id, fiatMinor: 100, wallet }), /limits/);
await assert.rejects(() => as(merchant, 'create-order', { adId: ad.id, fiatMinor: 1600000, wallet }), /own ad/);
const { id } = await as(buyer, 'create-order', { adId: ad.id, fiatMinor: 1600000, wallet });
let [order] = await as(buyer, 'my-orders');
assert.equal(order.units, 10_000_000); assert.equal(order.account_number, '0123456789', 'The buyer sees the bank details on their own order');
assert.equal((await as(buyer, 'market', { asset: 'USDC', currency: 'NGN' }))[0].available, 90_000_000);
await assert.rejects(() => as(other, 'mark-paid', { id }), /not found/, 'Another player cannot touch the order');

// Paid → the merchant releases through the server; stock moves once.
await as(buyer, 'mark-paid', { id });
await assert.rejects(() => as(buyer, 'cancel', { id }), /appeal/);
await assert.rejects(() => as(merchant, 'merchant-cancel', { id }), /Release it/);
const ref = await service('select public.ryvo_p2p_release_ref($1,$2,$3) as data', [id, merchant, 'Ref1111111111111111111111111111111111111111']);
assert.equal(ref.units, 10_000_000); assert.equal(ref.buyerWallet, wallet);
await assert.rejects(() => service('select public.ryvo_p2p_release_ref($1,$2,$3) as data', [id, other, 'X']), /not found/);
await service('select public.ryvo_p2p_mark_released($1,$2,$3) as data', [id, 'sig'.repeat(30), wallet]);
await service('select public.ryvo_p2p_mark_released($1,$2,$3) as data', [id, 'sig'.repeat(30), wallet]);
const adRow = (await db.query('select available_units, reserved_units from public.ryvo_p2p_ads where id=$1', [ad.id])).rows[0];
assert.deepEqual([Number(adRow.available_units), Number(adRow.reserved_units)], [90_000_000, 0], 'Released once: 10 USDC leaves the ad');
market = await as(buyer, 'market', { asset: 'USDC', currency: 'NGN' });
assert.equal(market[0].orders, 1); assert.equal(Number(market[0].completion), 100);

// Unpaid orders expire and return their reservation; appeals and admin cancel.
const second = await as(buyer, 'create-order', { adId: ad.id, fiatMinor: 800000, wallet });
await db.query(`update public.ryvo_p2p_orders set expires_at=now()-interval '1 minute' where id=$1`, [second.id]);
assert.equal((await as(buyer, 'market', { asset: 'USDC', currency: 'NGN' }))[0].available, 90_000_000, 'Expired orders free their amount');
const third = await as(buyer, 'create-order', { adId: ad.id, fiatMinor: 800000, wallet });
await as(buyer, 'mark-paid', { id: third.id });
await as(buyer, 'dispute', { id: third.id, reason: 'Paid but not released' });
await assert.rejects(() => as(buyer, 'admin-resolve', { id: third.id, outcome: 'cancelled' }), /Administrator/);
await as(admin, 'admin-resolve', { id: third.id, outcome: 'cancelled' });
assert.equal((await as(buyer, 'market', { asset: 'USDC', currency: 'NGN' }))[0].available, 90_000_000);

// Players cannot call the server-only functions.
await db.exec('set role authenticated');
await assert.rejects(() => db.query(`select public.ryvo_p2p_mark_released(gen_random_uuid(),'x','y')`), /permission denied/);
await db.exec('reset role');
console.log('P2P checks passed.');
