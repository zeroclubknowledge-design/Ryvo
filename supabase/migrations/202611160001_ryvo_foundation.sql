-- Ryvo foundation: run this entire script in the Supabase SQL Editor.
-- No sample balances, sample players, or sample competitions are inserted.
-- This establishes accounts and read access; it does NOT activate payments.
-- Money/credit changes must come from a trusted, verified server workflow.
begin;

create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  member_number bigint generated always as identity unique,
  credits bigint not null default 0 check (credits between 0 and 1000000000000),
  earnings numeric(18,2) not null default 0 check (earnings between 0 and 1000000000000),
  universal integer not null default 0 check (universal >= 0),
  tokens bigint not null default 0 check (tokens between 0 and 8000000),
  created_at timestamptz not null default now()
);
create table if not exists public.competitions (
  id text primary key,
  creator_id uuid not null references auth.users(id),
  definition jsonb not null check (jsonb_typeof(definition) = 'object' and definition->>'id' = id),
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (length(label) between 1 and 200),
  amount numeric(18,2) not null,
  currency text not null check (currency in ('NGN','RYVO')),
  reference text not null unique,
  date timestamptz not null default now()
);
create index if not exists wallet_entries_owner_date on public.wallet_entries(user_id, date desc);
create table if not exists public.player_boards (
  user_id uuid not null references auth.users(id) on delete cascade,
  competition_id text not null references public.competitions(id),
  pieces integer[] not null default '{}',
  primary key (user_id, competition_id)
);
create table if not exists public.token_program (
  id integer primary key check (id = 1),
  distributed bigint not null default 0 check (distributed between 0 and 8000000)
);
insert into public.token_program(id,distributed) values (1,0) on conflict (id) do nothing;

alter table public.wallets enable row level security;
alter table public.wallet_entries enable row level security;
alter table public.player_boards enable row level security;
alter table public.competitions enable row level security;
alter table public.token_program enable row level security;

-- Remove default API privileges, then grant only the reads the app needs.
revoke all on public.wallets, public.wallet_entries, public.player_boards, public.competitions, public.token_program from anon, authenticated;
grant select on public.wallets, public.wallet_entries, public.player_boards to authenticated;
grant select on public.competitions, public.token_program to anon, authenticated;

-- Named policies make the script safe to run again without resetting data.
drop policy if exists ryvo_own_wallet on public.wallets;
create policy ryvo_own_wallet on public.wallets for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists ryvo_own_entries on public.wallet_entries;
create policy ryvo_own_entries on public.wallet_entries for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists ryvo_own_boards on public.player_boards;
create policy ryvo_own_boards on public.player_boards for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists ryvo_published_competitions on public.competitions;
create policy ryvo_published_competitions on public.competitions for select to anon, authenticated using (published = true);
drop policy if exists ryvo_public_distribution on public.token_program;
create policy ryvo_public_distribution on public.token_program for select to anon, authenticated using (id = 1);

-- Only Auth can create the empty wallet for an actual registered account.
create or replace function public.ryvo_create_wallet()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.wallets(user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.ryvo_create_wallet() from public, anon, authenticated;
drop trigger if exists ryvo_auth_wallet on auth.users;
create trigger ryvo_auth_wallet after insert on auth.users for each row execute function public.ryvo_create_wallet();
insert into public.wallets(user_id) select id from auth.users order by created_at, id on conflict (user_id) do nothing;
commit;

-- Verify: five rows, each with row_security_enabled=true.
select tablename, rowsecurity as row_security_enabled from pg_tables
where schemaname='public' and tablename in ('wallets','wallet_entries','player_boards','competitions','token_program');
