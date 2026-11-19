-- Run in Supabase SQL Editor after 202611170004_solana_cashout.sql.
-- Creators launch competitions and players join them by paying USDC on Solana.
-- The browser never decides a payment: the server builds the transfer, checks
-- the signed transaction, confirms it on-chain, then calls the service-role
-- functions below. Amounts are USDC micro-units (1 USDC = 1,000,000).
-- Competition money fields stay in cents (the app's legacy unit): $1 = 100.
begin;

-- Fail with a clear message when this is run on a project missing the earlier migrations.
do $$ begin
 if to_regclass('public.competitions') is null or to_regclass('public.wallets') is null then
  raise exception 'Ryvo base tables are missing in this Supabase project. Check you opened the right project, then run 202611160001_ryvo_foundation.sql first.';
 end if;
 if to_regclass('public.ryvo_audit') is null then
  raise exception 'Run 202611160002_merchant_admin.sql before this migration.';
 end if;
end $$;

-- Public artwork for creator competitions: anyone may view, owners upload to their folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('competition-art','competition-art',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists ryvo_art_insert on storage.objects;
create policy ryvo_art_insert on storage.objects for insert to authenticated with check (
 bucket_id='competition-art' and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$'
);

create table if not exists public.ryvo_competition_payments(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 kind text not null check(kind in ('launch','entry')),
 competition_id text not null check(competition_id ~ '^[a-z0-9-]{3,90}$'),
 amount_micro bigint not null check(amount_micro between 1 and 1000000000000),
 reference text not null unique check(reference ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
 payer text check(payer ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
 draft jsonb,
 status text not null default 'pending' check(status in ('pending','paid','refund_due','expired')),
 signature text unique,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 paid_at timestamptz
);
create index if not exists ryvo_competition_payments_user on public.ryvo_competition_payments(user_id,created_at desc);
create unique index if not exists ryvo_one_pending_entry on public.ryvo_competition_payments(user_id,competition_id) where kind='entry' and status='pending';

create table if not exists public.competition_entries(
 competition_id text not null references public.competitions(id),
 user_id uuid not null references auth.users(id),
 payment_id uuid not null unique references public.ryvo_competition_payments(id),
 paid_micro bigint not null,
 credits bigint not null,
 created_at timestamptz not null default now(),
 primary key(competition_id,user_id)
);

alter table public.ryvo_competition_payments enable row level security;
alter table public.competition_entries enable row level security;
revoke all on public.ryvo_competition_payments, public.competition_entries from anon, authenticated;
grant select on public.ryvo_competition_payments, public.competition_entries to authenticated;
drop policy if exists ryvo_own_competition_payments on public.ryvo_competition_payments;
create policy ryvo_own_competition_payments on public.ryvo_competition_payments for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists ryvo_own_entries on public.competition_entries;
create policy ryvo_own_entries on public.competition_entries for select to authenticated using (user_id=(select auth.uid()));

-- Validate a launch or entry and open a 15-minute payment.
create or replace function public.ryvo_prepare_competition_payment(actor uuid,pay_kind text,competition text,launch_draft jsonb,ref text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.competitions; d jsonb; fee int; cap int; win int; share int; total int; amount bigint; p public.ryvo_competition_payments;
 art_path text; cover_path text;
begin
 if actor is null then raise exception 'Sign in to continue.'; end if;
 if pay_kind='launch' then
  if competition !~ '^custom-[a-f0-9-]{36}$' then raise exception 'Invalid competition.'; end if;
  if exists(select 1 from public.competitions where id=competition) then raise exception 'This competition already exists.'; end if;
  if (select count(*) from public.competitions where creator_id=actor and created_at>now()-interval '1 day')>=5 then raise exception 'You can launch up to five competitions a day.'; end if;
  fee:=(launch_draft->>'fee')::int; cap:=(launch_draft->>'capacity')::int; win:=(launch_draft->>'winners')::int; share:=(launch_draft->>'creatorShare')::int; total:=(launch_draft->>'total')::int;
  art_path:=launch_draft->>'artworkPath'; cover_path:=launch_draft->>'coverPath';
  if length(trim(coalesce(launch_draft->>'title','')))not between 3 and 70
   or length(trim(coalesce(launch_draft->>'description','')))not between 20 and 1200
   or length(trim(coalesce(launch_draft->>'artist','')))not between 2 and 80
   or fee not in (500,1000,2000) or share not in (5,10)
   or total not between 10 and 50 or cap not between 2 and 10000 or win not between 1 and cap
   or art_path !~ ('^'||actor::text||'/[a-f0-9-]{36}\.(jpg|png|webp)$')
   or cover_path !~ ('^'||actor::text||'/[a-f0-9-]{36}\.(jpg|png|webp)$')
  then raise exception 'Check your artwork, title, story, 10–50 pieces, player capacity, winner slots and entry fee.'; end if;
  -- Launch fee: half the creator share of projected entries, in cents → micro-USDC.
  amount:=greatest(1,round(fee::numeric*cap*share/200))::bigint*10000;
  d:=jsonb_build_object('title',trim(launch_draft->>'title'),'description',trim(launch_draft->>'description'),'artist',trim(launch_draft->>'artist'),
   'fee',fee,'capacity',cap,'winners',win,'creatorShare',share,'total',total,'artworkPath',art_path,'coverPath',cover_path);
 elsif pay_kind='entry' then
  select * into c from public.competitions where id=competition and published;
  if not found then raise exception 'This competition is unavailable.'; end if;
  if c.definition->>'status'<>'open' then raise exception 'Registration for this competition has closed.'; end if;
  if (c.definition->>'joined')::int>=(c.definition->>'capacity')::int then raise exception 'This competition is full.'; end if;
  if exists(select 1 from public.competition_entries where competition_id=competition and user_id=actor) then raise exception 'You have already joined this competition.'; end if;
  amount:=(c.definition->>'fee')::bigint*10000;
  update public.ryvo_competition_payments set status='expired' where user_id=actor and competition_id=competition and kind='entry' and status='pending';
 else
  raise exception 'Invalid payment.';
 end if;
 insert into public.ryvo_competition_payments(user_id,kind,competition_id,amount_micro,reference,draft,expires_at)
 values(actor,pay_kind,competition,amount,ref,d,now()+interval '15 minutes') returning * into p;
 return jsonb_build_object('id',p.id,'amountMicro',p.amount_micro,'reference',p.reference,'expiresAt',p.expires_at);
end $$;

-- Record a payment the server has confirmed on Solana. Safe to call twice.
create or replace function public.ryvo_settle_competition_payment(payment uuid,sig text,payer_wallet text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.ryvo_competition_payments; c public.competitions; d jsonb; issued bigint; joined int; cap int; display text;
begin
 select * into p from public.ryvo_competition_payments where id=payment for update;
 if not found then raise exception 'Payment not found.'; end if;
 if p.status='paid' then return jsonb_build_object('status','paid','competitionId',p.competition_id); end if;
 if p.status='refund_due' then return jsonb_build_object('status','refund_due','competitionId',p.competition_id); end if;
 if length(sig)<64 then raise exception 'Invalid signature.'; end if;
 update public.ryvo_competition_payments set status='paid',signature=sig,payer=payer_wallet,paid_at=now() where id=p.id;

 if p.kind='launch' then
  d:=p.draft;
  display:=d->>'artist';
  insert into public.competitions(id,creator_id,definition,published) values(p.competition_id,p.user_id,jsonb_build_object(
   'id',p.competition_id,'title',d->>'title','description',d->>'description','artist',display,'category','Digital Art',
   'theme','art:'||(d->>'artworkPath'),'coverKey',d->>'coverPath','artworkKey',d->>'artworkPath',
   'total',(d->>'total')::int,'owned','[]'::jsonb,'fee',(d->>'fee')::int,'capacity',(d->>'capacity')::int,'joined',0,
   'winners',(d->>'winners')::int,'remaining',(d->>'winners')::int,'days',30,'status','open',
   'prize',round((d->>'fee')::numeric*(d->>'capacity')::int*0.2),'creatorShare',(d->>'creatorShare')::int,
   'launchFeeMicro',p.amount_micro,'createdAt',now()),true);
  insert into public.ryvo_audit(actor,action,subject) values(p.user_id,'competition:launch',p.competition_id);
  return jsonb_build_object('status','paid','competitionId',p.competition_id);
 end if;

 select * into c from public.competitions where id=p.competition_id for update;
 joined:=coalesce((c.definition->>'joined')::int,0); cap:=(c.definition->>'capacity')::int;
 if c.definition->>'status'<>'open' or joined>=cap or exists(select 1 from public.competition_entries where competition_id=p.competition_id and user_id=p.user_id) then
  -- Paid after the competition filled (or twice): keep the money traceable for a refund.
  update public.ryvo_competition_payments set status='refund_due' where id=p.id;
  return jsonb_build_object('status','refund_due','competitionId',p.competition_id);
 end if;
 issued:=(c.definition->>'fee')::bigint*10;
 insert into public.competition_entries(competition_id,user_id,payment_id,paid_micro,credits) values(p.competition_id,p.user_id,p.id,p.amount_micro,issued);
 insert into public.player_boards(user_id,competition_id,pieces) values(p.user_id,p.competition_id,'{}') on conflict do nothing;
 insert into public.wallets(user_id,credits) values(p.user_id,issued) on conflict(user_id) do update set credits=public.wallets.credits+excluded.credits;
 insert into public.wallet_entries(user_id,label,amount,currency,reference) values(p.user_id,'Registration credit · '||(c.definition->>'title'),issued,'RYVO','entry:'||p.id);
 joined:=joined+1;
 update public.competitions set definition=definition||jsonb_build_object('joined',joined)
  ||case when joined>=cap then jsonb_build_object('status','active','startedAt',now(),'endsAt',now()+interval '1 month') else '{}'::jsonb end
 where id=c.id;
 return jsonb_build_object('status','paid','competitionId',p.competition_id,'credits',issued);
end $$;

revoke all on function public.ryvo_prepare_competition_payment(uuid,text,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.ryvo_settle_competition_payment(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ryvo_prepare_competition_payment(uuid,text,text,jsonb,text) to service_role;
grant execute on function public.ryvo_settle_competition_payment(uuid,text,text) to service_role;
commit;
