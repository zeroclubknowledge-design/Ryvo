// Runs every migration in PGlite and checks referral linking and rewards.
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
const addUser = (n, meta) => db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [uid(n), `${n}@example.invalid`, JSON.stringify(meta)]);
const b58 = () => { const a = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; return Array.from({ length: 44 }, () => a[Math.floor(Math.random() * 58)]).join(''); };
const service = async (sql, params) => { await db.exec('set role service_role'); try { return (await db.query(sql, params)).rows[0]?.data; } finally { await db.exec('reset role'); } };
const as = async (id, sql) => { await db.exec('set role authenticated'); await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]); try { return (await db.query(sql)).rows[0]?.data; } finally { await db.exec('reset role'); } };

const referrer = uid(1), creator = uid(2);
await addUser(1, { username: 'ada' });
await addUser(2, { username: 'creator' });
await addUser(3, { username: 'self.ref', referred_by: 'self.ref' });
await addUser(4, { username: 'ghost', referred_by: 'nobody' });
for (let n = 10; n < 16; n++) await addUser(n, { username: `player${n}`, referred_by: n === 15 ? 'creator' : 'ADA' });

const links = (await db.query('select referred_id, referrer_id, via_username from public.ryvo_referrals order by referred_id')).rows;
assert.equal(links.filter(l => l.referrer_id === referrer).length, 5, 'Username match ignores capitalisation');
assert.ok(!links.some(l => l.referred_id === uid(3)), 'Self-referrals are ignored');
assert.ok(!links.some(l => l.referred_id === uid(4)), 'Unknown usernames are ignored');
await db.query(`update auth.users set raw_user_meta_data='{"username":"player10","referred_by":"creator"}' where id=$1`, [uid(10)]);
assert.equal((await db.query('select referrer_id from public.ryvo_referrals where referred_id=$1', [uid(10)])).rows[0].referrer_id, referrer, 'Editing details later cannot move a referral');
await assert.rejects(() => as(uid(10), 'select * from public.ryvo_referrals'), /permission denied/);

// A $10, 10-player competition; five of ada's referrals join.
const id = `custom-${crypto.randomUUID()}`, art = `${creator}/${crypto.randomUUID()}.jpg`;
const launch = await service('select public.ryvo_prepare_competition_payment($1,$2,$3,$4::jsonb,$5) as data', [creator, 'launch', id,
  JSON.stringify({ title: 'Harbour at dusk', description: 'A quiet harbour painted at the last light of day.', artist: 'Ada', fee: 1000, capacity: 10, winners: 1, total: 12, artworkPath: art, coverPath: art }), b58()]);
await service('select public.ryvo_settle_competition_payment($1,$2,$3) as data', [launch.id, b58() + b58(), b58()]);
const join = async (n) => { const e = await service('select public.ryvo_prepare_competition_payment($1,$2,$3,null,$4) as data', [uid(n), 'entry', id, b58()]); await service('select public.ryvo_settle_competition_payment($1,$2,$3) as data', [e.id, b58() + b58(), b58()]); };
for (let n = 10; n < 15; n++) await join(n);

const earned = Number((await db.query('select available_micro from public.ryvo_usdc_earnings where user_id=$1', [referrer])).rows[0].available_micro);
assert.equal(earned, 5 * 2_500_000, 'Under 10,000 players the rate is 50% of Ryvo’s $5.00 half: $2.50 per $10 entry');
const split = (await db.query('select referral_micro, ryvo_micro, referrer_id from public.ryvo_entry_splits where competition_id=$1 limit 1', [id])).rows[0];
assert.equal(Number(split.referral_micro), 2_500_000); assert.equal(split.referrer_id, referrer);
const pieces = (await db.query(`select source_reference from public.ryvo_universal_entitlements where user_id=$1 and source='referral'`, [referrer])).rows;
assert.equal(pieces.length, 1, 'The fifth qualifying referral earns one Universal piece');

const mine = await as(referrer, 'select public.ryvo_my_referrals() as data');
assert.deepEqual([mine.joined, mine.qualifying, Number(mine.earnedMicro), mine.rate], [5, 5, 12_500_000, 50]);

// Level programme: a referrer with no completed boards earns 10% of Ryvo's half.
await db.query(`update auth.users set raw_user_meta_data=raw_user_meta_data||'{"referral_scheme":"level"}' where id=$1`, [uid(2)]);
await join(15);
const levelSplit = (await db.query('select referral_micro from public.ryvo_entry_splits s join public.ryvo_competition_payments p on p.id=s.payment_id where p.user_id=$1', [uid(15)])).rows[0];
assert.equal(Number(levelSplit.referral_micro), 500_000, 'Level 1 is 10% of Ryvo’s half: $0.50');
console.log('Referral checks passed.');
