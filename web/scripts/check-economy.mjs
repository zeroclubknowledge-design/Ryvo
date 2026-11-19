// Runs every migration in PGlite and checks the competition money split,
// Universal piece swaps and listings, and the admin economy report.
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

const [admin, creator, seller, buyer] = [1, 2, 3, 4].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
for (const id of [admin, creator, seller, buyer]) await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${id.slice(-1)}@example.invalid`]);
await db.query(`insert into public.ryvo_staff(user_id,role) values($1,'admin')`, [admin]);
const b58 = () => { const a = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; return Array.from({ length: 44 }, () => a[Math.floor(Math.random() * 58)]).join(''); };
const service = async (sql, params) => { await db.exec('set role service_role'); try { return (await db.query(sql, params)).rows[0]?.data; } finally { await db.exec('reset role'); } };
const as = async (id, sql, params = []) => { await db.exec('set role authenticated'); await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]); try { return (await db.query(sql, params)).rows[0]?.data; } finally { await db.exec('reset role'); } };
const universal = (id, action, payload = {}) => as(id, 'select public.ryvo_universal($1,$2::jsonb) as data', [action, JSON.stringify(payload)]);
const economy = (id, action, payload = {}) => as(id, 'select public.ryvo_economy($1,$2::jsonb) as data', [action, JSON.stringify(payload)]);
const share = async (p, w) => Number((await db.query('select public.ryvo_winner_share($1,$2) v', [p, w])).rows[0].v);

// Winners' share rises with the winner ratio, from 10% to a 40% ceiling at half the players.
assert.equal(await share(1000, 10), 14.2);
assert.equal(await share(100, 10), 23.4);
assert.equal(await share(4, 1), 31.2);
assert.equal(await share(2, 1), 40);
assert.equal(await share(10, 9), 40, 'Capped at 40%');

// Launch a 4-player, 1-winner, $10 competition and fill it.
const id = `custom-${crypto.randomUUID()}`;
const art = `${creator}/${crypto.randomUUID()}.jpg`;
const launch = await service('select public.ryvo_prepare_competition_payment($1,$2,$3,$4::jsonb,$5) as data',
  [creator, 'launch', id, JSON.stringify({ title: 'Harbour at dusk', description: 'A quiet harbour painted at the last light of day.', artist: 'Ada', fee: 1000, capacity: 4, winners: 1, total: 12, artworkPath: art, coverPath: art }), b58()]);
await service('select public.ryvo_settle_competition_payment($1,$2,$3) as data', [launch.id, b58() + b58(), b58()]);
const def = (await db.query('select definition from public.competitions where id=$1', [id])).rows[0].definition;
assert.equal(Number(def.winnerShare), 31.2); assert.equal(def.prize, 1248, 'Prize pool is 31.2% of $10 × 4 = $12.48');
for (const player of [seller, buyer]) {
  const entry = await service('select public.ryvo_prepare_competition_payment($1,$2,$3,null,$4) as data', [player, 'entry', id, b58()]);
  await service('select public.ryvo_settle_competition_payment($1,$2,$3) as data', [entry.id, b58() + b58(), b58()]);
}
const [split] = (await db.query('select * from public.ryvo_entry_splits limit 1')).rows;
assert.deepEqual([split.amount_micro, split.winners_micro, split.creator_micro, split.ryvo_micro, split.pool_micro].map(Number),
  [10_000_000, 3_120_000, 1_000_000, 5_000_000, 880_000], '$10 entry: winners 31.2%, creator 10%, Ryvo 50%, pool 8.8%');

// Admin report: only admins, with the totals that add up.
await assert.rejects(() => economy(creator, 'report'), /Administrator/);
const report = await economy(admin, 'report');
assert.equal(report.totals.entries, 2); assert.equal(report.totals.pool, 1_760_000); assert.equal(report.launchFees, launch.amountMicro);
assert.equal(report.competitions[0].poolMicro, 1_760_000);

// Universal pieces: everyone has a welcome piece; give the seller two more.
for (const n of [1, 2]) await db.query(`insert into public.ryvo_universal_entitlements(user_id,source,source_reference,issued_at,expires_at) values($1,'referral',$2,now(),now()+interval '720 hours')`, [seller, `test:${n}`]);
let state = await universal(seller, 'state');
assert.equal(state.pieces.length, 3); assert.equal(Number(state.tokenRate), 1); assert.equal(state.usdCents, 50);
assert.deepEqual(state.competitions.map(c => c.id), [id]);

// Token demand: target 1 conversion a day, so the second conversion beyond it halves the rate.
await economy(admin, 'save-settings', { tokenDemandTarget: 1, universalUsdCents: 75 });
const t1 = await universal(seller, 'to-token', { id: state.pieces[0].id, expectedRate: 1 });
assert.equal(t1.tokenMicro, 1_000_000);
const t2 = await universal(seller, 'to-token', { id: state.pieces[1].id, expectedRate: 1 });
assert.equal(Number(t2.rate), 1, 'At the target the rate is still normal');
const buyerPiece = (await universal(buyer, 'state')).pieces[0];
await assert.rejects(() => universal(buyer, 'to-token', { id: buyerPiece.id, expectedRate: 1 }), /rate changed to 0.5/);
assert.equal(Number((await universal(buyer, 'state')).tokenRate), 0.5, 'Above the target, fewer tokens per piece');
await assert.rejects(() => universal(seller, 'to-token', { id: state.pieces[0].id }), /no longer available/, 'A piece is spent once');

// USD swap at the admin price.
const usdPiece = (await universal(creator, 'state')).pieces[0];
await assert.rejects(() => universal(creator, 'to-usd', { id: usdPiece.id, expectedCents: 50 }), /price changed/);
assert.equal((await universal(creator, 'to-usd', { id: usdPiece.id, expectedCents: 75 })).usdMicro, 750_000);

// List in the competition marketplace; another player buys it with RYVO Credit.
const piece = (await universal(seller, 'state')).pieces[0];
await assert.rejects(() => universal(creator, 'buy', { listingId: crypto.randomUUID() }), /already been sold/);
const { listingId } = await universal(seller, 'list', { id: piece.id, competitionId: id, price: 1000 });
await assert.rejects(() => universal(seller, 'to-usd', { id: piece.id }), /Cancel this piece/);
assert.equal((await universal(buyer, 'market', { competitionId: id })).length, 1);
await assert.rejects(() => universal(creator, 'buy', { listingId }), /Join this competition/);
await universal(buyer, 'buy', { listingId });
await assert.rejects(() => universal(buyer, 'buy', { listingId }), /already been sold/, 'Sold once');
assert.equal(Number((await db.query('select credits from public.wallets where user_id=$1', [buyer])).rows[0].credits), 9000, 'Buyer pays 1,000 r/');
assert.equal(Number((await db.query('select available_micro from public.ryvo_usdc_earnings where user_id=$1', [seller])).rows[0].available_micro), 995_000, 'Seller gets $0.995 after the 0.5% fee');
assert.equal((await universal(buyer, 'state')).pieces.length, 2, 'Buyer now holds the bought piece too');

const after = await economy(admin, 'report');
assert.equal(after.universal.sold, 1); assert.equal(after.universal.usdMicro, 750_000); assert.equal(after.settings.universalUsdCents, 75);
console.log('Economy checks passed.');
