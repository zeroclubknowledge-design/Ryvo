// Runs every migration in PGlite and checks USDC competition launches and entries.
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

const [creator, player, late] = [1, 2, 3].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
for (const id of [creator, player, late]) await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${id.slice(-1)}@example.invalid`]);
const ref = () => { const a = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; return Array.from({ length: 44 }, () => a[Math.floor(Math.random() * 58)]).join(''); };
const sig = () => ref() + ref();
const service = async (sql, params) => { await db.exec('set role service_role'); try { return (await db.query(sql, params)).rows[0]?.data; } finally { await db.exec('reset role'); } };
await db.exec('grant usage on schema public to service_role');
const prepare = (actor, kind, id, draft = null) => service('select public.ryvo_prepare_competition_payment($1,$2,$3,$4::jsonb,$5) as data', [actor, kind, id, draft && JSON.stringify(draft), ref()]);
const settle = (id) => service('select public.ryvo_settle_competition_payment($1,$2,$3) as data', [id, sig(), ref()]);

// Players cannot call the payment functions themselves.
await db.exec('set role authenticated');
await assert.rejects(() => db.query(`select public.ryvo_settle_competition_payment(gen_random_uuid(),'x','y')`), /permission denied/);
await db.exec('reset role');

const id = `custom-${crypto.randomUUID()}`;
const art = `${creator}/${crypto.randomUUID()}.jpg`;
const draft = { title: 'Harbour at dusk', description: 'A quiet harbour painted at the last light of day.', artist: 'Ada', fee: 1000, capacity: 2, winners: 1, creatorShare: 5, total: 12, artworkPath: art, coverPath: art };
await assert.rejects(() => prepare(creator, 'launch', id, { ...draft, artworkPath: `${player}/${crypto.randomUUID()}.jpg` }), /Check your artwork/, 'Artwork must be in the creator’s own folder');
const launch = await prepare(creator, 'launch', id, draft);
assert.equal(launch.amountMicro, 1140000, 'Launch fee: $1 + 2×$0.01 + 1×$0.10 + 24 pieces in play×$0.0005 = $1.132 → $1.14');
await assert.rejects(() => prepare(player, 'entry', id), /unavailable/, 'Unpaid launches are not joinable');
assert.equal((await settle(launch.id)).status, 'paid');
assert.equal((await settle(launch.id)).status, 'paid', 'Settling twice is harmless');
const [comp] = (await db.query('select published,definition from public.competitions where id=$1', [id])).rows;
assert.equal(comp.published, true); assert.equal(comp.definition.status, 'open'); assert.equal(comp.definition.prize, 800, '1 winner of 2 players earns the 40% ceiling: $8.00');
assert.equal(comp.definition.theme, `art:${art}`);
assert.equal(comp.definition.creatorShare, 10, 'Creators earn a fixed 10% share');

const entry = await prepare(player, 'entry', id);
assert.equal(entry.amountMicro, 10000000, '$10 entry is 10 USDC');
const joined = await settle(entry.id);
assert.equal(joined.credits, 10000, '$10 issues 10,000 r/');
await settle(entry.id);
assert.equal((await db.query('select credits from public.wallets where user_id=$1', [player])).rows[0].credits, 10000, 'Credits are issued once');
assert.equal((await db.query('select count(*)::int n from public.player_boards where user_id=$1', [player])).rows[0].n, 1);
await assert.rejects(() => prepare(player, 'entry', id), /already joined/);

const lateA = await prepare(late, 'entry', id);
const lateB = await prepare(creator, 'entry', id);
assert.equal((await settle(lateA.id)).status, 'paid');
const after = (await db.query('select definition from public.competitions where id=$1', [id])).rows[0].definition;
assert.equal(after.joined, 2); assert.equal(after.status, 'active', 'Filling capacity starts the round');
assert.ok(after.endsAt, 'An active round has an end date');
assert.equal((await settle(lateB.id)).status, 'refund_due', 'Paying after it filled is held for refund, not joined');
await assert.rejects(() => prepare(creator, 'entry', id), /closed/);

console.log('Competition payment checks passed.');
