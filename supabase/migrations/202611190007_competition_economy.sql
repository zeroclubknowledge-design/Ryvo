-- Run in Supabase SQL Editor after 202611190006_launch_fee_formula.sql.
-- Competition money split, Universal piece swaps and listings, and the
-- admin economy report.
--
-- Every entry is split:   winners 10–40% (set by the winner ratio)
--                          creator 10%
--                          Ryvo    50%  (referral rewards are paid from this half)
--                          token launch pool = the rest (40% − winners' share)
-- Winners' share = 10% + 30% × √(min(winners/players, 50%) / 50%), to 0.1%.
begin;
do $$ begin
 if to_regprocedure('public.ryvo_prepare_competition_payment(uuid,text,text,jsonb,text)') is null then
  raise exception 'Run 202611190005 and 202611190006 in this Supabase project first.';
 end if;
end $$;

create or replace function public.ryvo_winner_share(players int, winners int) returns numeric
language sql immutable set search_path='' as $$
 select round(10 + 30*sqrt(least(greatest(winners,0)::numeric/greatest(players,1),0.5)/0.5), 1)
$$;

create table if not exists public.ryvo_entry_splits(
 payment_id uuid primary key references public.ryvo_competition_payments(id),
 competition_id text not null references public.competitions(id),
 creator_id uuid not null references auth.users(id),
 amount_micro bigint not null check(amount_micro>0),
 winners_micro bigint not null, creator_micro bigint not null, ryvo_micro bigint not null,
 referral_micro bigint not null default 0, referrer_id uuid references auth.users(id),
 pool_micro bigint not null check(pool_micro>=0),
 winner_share numeric not null check(winner_share between 10 and 40),
 created_at timestamptz not null default now(),
 check(winners_micro+creator_micro+ryvo_micro+pool_micro=amount_micro),
 check(referral_micro between 0 and ryvo_micro)
);
create index if not exists ryvo_entry_splits_competition on public.ryvo_entry_splits(competition_id);

-- Admin-tuned economy settings: Universal piece USD price and the token demand target.
create table if not exists public.ryvo_economy_settings(
 id integer primary key check(id=1),
 universal_usd_cents integer not null default 50 check(universal_usd_cents between 1 and 100000),
 token_demand_target integer not null default 100 check(token_demand_target between 1 and 1000000)
);
insert into public.ryvo_economy_settings(id) values(1) on conflict do nothing;

-- Fractional tokens from Universal conversions, in micro-tokens (1 token = 1,000,000).
alter table public.wallets add column if not exists token_micro bigint not null default 0 check(token_micro>=0);
alter table public.token_program add column if not exists converted_micro bigint not null default 0 check(converted_micro>=0);

-- Universal pieces can now be bought from another player.
alter table public.ryvo_universal_entitlements drop constraint if exists ryvo_universal_entitlements_source_check;
alter table public.ryvo_universal_entitlements add constraint ryvo_universal_entitlements_source_check check(source in ('welcome','referral','purchase'));
alter table public.ryvo_universal_entitlements add column if not exists redeemed_for text check(redeemed_for in ('board','token','usd','listing','sold'));

create table if not exists public.ryvo_universal_swaps(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 entitlement_id uuid not null unique references public.ryvo_universal_entitlements(id),
 kind text not null check(kind in ('token','usd')),
 token_micro bigint not null default 0, usd_micro bigint not null default 0, rate numeric,
 created_at timestamptz not null default now()
);
create index if not exists ryvo_universal_swaps_recent on public.ryvo_universal_swaps(kind,created_at desc);

create table if not exists public.ryvo_universal_listings(
 id uuid primary key default gen_random_uuid(),
 seller_id uuid not null references auth.users(id),
 entitlement_id uuid not null references public.ryvo_universal_entitlements(id),
 competition_id text not null references public.competitions(id),
 price_credits bigint not null check(price_credits between 100 and 1000000),
 status text not null default 'active' check(status in ('active','sold','cancelled')),
 buyer_id uuid references auth.users(id),
 created_at timestamptz not null default now(), closed_at timestamptz
);
create unique index if not exists ryvo_one_active_listing_per_piece on public.ryvo_universal_listings(entitlement_id) where status='active';
create index if not exists ryvo_universal_listings_competition on public.ryvo_universal_listings(competition_id,status);

alter table public.ryvo_entry_splits enable row level security;
alter table public.ryvo_economy_settings enable row level security;
alter table public.ryvo_universal_swaps enable row level security;
alter table public.ryvo_universal_listings enable row level security;
revoke all on public.ryvo_entry_splits, public.ryvo_economy_settings, public.ryvo_universal_swaps, public.ryvo_universal_listings from anon, authenticated;

-- Competitions nobody has joined yet adopt the new winner share and prize pool;
-- anything already joined keeps the prize its players paid in for.
update public.competitions set definition=definition||jsonb_build_object(
  'winnerShare',public.ryvo_winner_share((definition->>'capacity')::int,(definition->>'winners')::int),
  'prize',round((definition->>'fee')::numeric*(definition->>'capacity')::int*public.ryvo_winner_share((definition->>'capacity')::int,(definition->>'winners')::int)/100),
  'creatorShare',10)
where definition ? 'capacity' and definition ? 'winners' and definition ? 'fee' and coalesce((definition->>'joined')::int,0)=0;

-- Record a payment the server has confirmed on Solana. Safe to call twice.
create or replace function public.ryvo_settle_competition_payment(payment uuid,sig text,payer_wallet text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.ryvo_competition_payments; c public.competitions; d jsonb; issued bigint; joined int; cap int; display text; share numeric; ryvo bigint; winners_part bigint; creator_part bigint;
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
   'prize',round((d->>'fee')::numeric*(d->>'capacity')::int*public.ryvo_winner_share((d->>'capacity')::int,(d->>'winners')::int)/100),
   'winnerShare',public.ryvo_winner_share((d->>'capacity')::int,(d->>'winners')::int),'creatorShare',10,
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
 -- Split this entry: winners 10–40% (by winner ratio), creator 10%, Ryvo 50%
 -- (referral rewards come out of Ryvo's half), the rest to the token launch pool.
 share:=coalesce((c.definition->>'winnerShare')::numeric,public.ryvo_winner_share(cap,(c.definition->>'winners')::int));
 winners_part:=round(p.amount_micro*share/100); creator_part:=round(p.amount_micro*0.10); ryvo:=round(p.amount_micro*0.50);
 insert into public.ryvo_entry_splits(payment_id,competition_id,creator_id,amount_micro,winners_micro,creator_micro,ryvo_micro,referral_micro,pool_micro,winner_share)
 values(p.id,p.competition_id,c.creator_id,p.amount_micro,winners_part,creator_part,ryvo,0,p.amount_micro-winners_part-creator_part-ryvo,share);
 joined:=joined+1;
 update public.competitions set definition=definition||jsonb_build_object('joined',joined)
  ||case when joined>=cap then jsonb_build_object('status','active','startedAt',now(),'endsAt',now()+interval '1 month') else '{}'::jsonb end
 where id=c.id;
 return jsonb_build_object('status','paid','competitionId',p.competition_id,'credits',issued);
end $$;

revoke all on function public.ryvo_settle_competition_payment(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ryvo_settle_competition_payment(uuid,text,text) to service_role;

-- Current tokens per Universal piece: 1 while conversions in the last 24 hours
-- stay at or below the target, then target ÷ conversions (never below 0.1).
create or replace function public.ryvo_universal_token_rate() returns numeric
language sql stable security definer set search_path='' as $$
 select case when n<=t then 1::numeric else greatest(0.1, round(t::numeric/n, 4)) end
 from (select count(*) n from public.ryvo_universal_swaps where kind='token' and created_at>now()-interval '24 hours') s,
      (select token_demand_target t from public.ryvo_economy_settings where id=1) e
$$;

-- Player actions on Universal pieces. Every money change happens here, in one transaction.
create or replace function public.ryvo_universal(action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); e public.ryvo_universal_entitlements; l public.ryvo_universal_listings; c public.competitions;
 rate numeric; cents int; micro bigint; price bigint; bal bigint; tp public.token_program;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;

 if action='state' then
  return jsonb_build_object(
   'pieces',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'source',x.source,'expiresAt',x.expires_at,
      'listingId',(select id from public.ryvo_universal_listings where entitlement_id=x.id and status='active'))
      order by x.expires_at) from public.ryvo_universal_entitlements x
     where x.user_id=uid and x.redeemed_at is null and x.expires_at>now()),'[]'),
   'tokenRate',public.ryvo_universal_token_rate(),
   'usdCents',(select universal_usd_cents from public.ryvo_economy_settings where id=1),
   'tokenMicro',coalesce((select token_micro from public.wallets where user_id=uid),0),
   'competitions',coalesce((select jsonb_agg(jsonb_build_object('id',k.id,'title',k.definition->>'title'))
     from public.competitions k join public.competition_entries ce on ce.competition_id=k.id and ce.user_id=uid
     where k.definition->>'status' in ('open','active')),'[]'));
 end if;

 if action='market' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'price',x.price_credits,'mine',x.seller_id=uid,'listedAt',x.created_at) order by x.price_credits)
   from public.ryvo_universal_listings x where x.competition_id=payload->>'competitionId' and x.status='active'),'[]');
 end if;

 if action in ('to-token','to-usd','list') then
  select * into e from public.ryvo_universal_entitlements where id=(payload->>'id')::uuid and user_id=uid for update;
  if not found or e.redeemed_at is not null or e.expires_at<=now() then raise exception 'This Universal piece is no longer available.'; end if;
  if exists(select 1 from public.ryvo_universal_listings where entitlement_id=e.id and status='active') then
   raise exception 'Cancel this piece''s listing before using it.'; end if;
 end if;

 if action='to-token' then
  select * into tp from public.token_program where id=1 for update;  -- serialises conversions so the rate is fair
  rate:=public.ryvo_universal_token_rate();
  if payload ? 'expectedRate' and abs(rate-(payload->>'expectedRate')::numeric)>0.00005 then
   raise exception 'The rate changed to % RYVO per piece. Review it and try again.', rate; end if;
  micro:=round(rate*1000000);
  if tp.distributed::numeric*1000000+tp.converted_micro+micro>8000000000000 then raise exception 'The community token allocation is fully distributed.'; end if;
  update public.ryvo_universal_entitlements set redeemed_at=now(),redeemed_for='token' where id=e.id;
  update public.token_program set converted_micro=converted_micro+micro where id=1;
  insert into public.wallets(user_id,token_micro) values(uid,micro) on conflict(user_id) do update set token_micro=public.wallets.token_micro+excluded.token_micro;
  insert into public.ryvo_universal_swaps(user_id,entitlement_id,kind,token_micro,rate) values(uid,e.id,'token',micro,rate);
  return jsonb_build_object('tokenMicro',micro,'rate',rate);
 end if;

 if action='to-usd' then
  select universal_usd_cents into cents from public.ryvo_economy_settings where id=1;
  if payload ? 'expectedCents' and cents<>(payload->>'expectedCents')::int then
   raise exception 'The price changed to $%. Review it and try again.', to_char(cents/100.0,'FM999990.00'); end if;
  micro:=cents::bigint*10000;
  update public.ryvo_universal_entitlements set redeemed_at=now(),redeemed_for='usd' where id=e.id;
  insert into public.ryvo_usdc_entries(user_id,amount_micro,kind,reference) values(uid,micro,'earning','universal:'||e.id);
  insert into public.ryvo_usdc_earnings(user_id,available_micro) values(uid,micro) on conflict(user_id) do update set available_micro=public.ryvo_usdc_earnings.available_micro+excluded.available_micro;
  insert into public.ryvo_universal_swaps(user_id,entitlement_id,kind,usd_micro) values(uid,e.id,'usd',micro);
  return jsonb_build_object('usdMicro',micro);
 end if;

 if action='list' then
  price:=(payload->>'price')::bigint;
  if price is null or price not between 100 and 1000000 then raise exception 'Set a price from 100 to 1,000,000 r/.'; end if;
  select * into c from public.competitions where id=payload->>'competitionId' and published;
  if not found or c.definition->>'status' not in ('open','active') then raise exception 'That competition isn''t taking listings.'; end if;
  if not exists(select 1 from public.competition_entries where competition_id=c.id and user_id=uid) then raise exception 'Join this competition to list in its marketplace.'; end if;
  insert into public.ryvo_universal_listings(seller_id,entitlement_id,competition_id,price_credits) values(uid,e.id,c.id,price) returning * into l;
  return jsonb_build_object('listingId',l.id);
 end if;

 if action='cancel' then
  update public.ryvo_universal_listings set status='cancelled',closed_at=now() where id=(payload->>'listingId')::uuid and seller_id=uid and status='active';
  if not found then raise exception 'This listing is no longer active.'; end if;
  return jsonb_build_object('status','cancelled');
 end if;

 if action='buy' then
  select * into l from public.ryvo_universal_listings where id=(payload->>'listingId')::uuid for update;
  if not found or l.status<>'active' then raise exception 'This piece has already been sold.'; end if;
  if l.seller_id=uid then raise exception 'You can''t buy your own listing.'; end if;
  if not exists(select 1 from public.competition_entries where competition_id=l.competition_id and user_id=uid) then raise exception 'Join this competition to buy from its marketplace.'; end if;
  select * into e from public.ryvo_universal_entitlements where id=l.entitlement_id for update;
  if e.redeemed_at is not null or e.expires_at<=now() then
   update public.ryvo_universal_listings set status='cancelled',closed_at=now() where id=l.id;
   raise exception 'This piece expired before it sold.'; end if;
  select w.credits into bal from public.wallets w where w.user_id=uid for update;
  if coalesce(bal,0)<l.price_credits then raise exception 'You need % r/ to buy this piece.', l.price_credits; end if;
  update public.wallets w set credits=w.credits-l.price_credits where w.user_id=uid;
  insert into public.wallet_entries(user_id,label,amount,currency,reference) values(uid,'Universal piece · bought',-l.price_credits,'RYVO','universal-buy:'||l.id);
  -- Seller receives the dollar value at 1,000 r/ = $1, less the 0.5% marketplace fee.
  micro:=l.price_credits*995;
  insert into public.ryvo_usdc_entries(user_id,amount_micro,kind,reference) values(l.seller_id,micro,'earning','universal-sale:'||l.id);
  insert into public.ryvo_usdc_earnings(user_id,available_micro) values(l.seller_id,micro) on conflict(user_id) do update set available_micro=public.ryvo_usdc_earnings.available_micro+excluded.available_micro;
  update public.ryvo_universal_entitlements set redeemed_at=now(),redeemed_for='sold' where id=e.id;
  insert into public.ryvo_universal_entitlements(user_id,source,source_reference,issued_at,expires_at) values(uid,'purchase','purchase:'||l.id,e.issued_at,e.expires_at);
  update public.ryvo_universal_listings set status='sold',buyer_id=uid,closed_at=now() where id=l.id;
  return jsonb_build_object('status','sold','sellerMicro',micro);
 end if;

 raise exception 'Invalid request.';
end $$;

-- Admin-only view of where the money goes, plus economy settings.
create or replace function public.ryvo_economy(action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if not exists(select 1 from public.ryvo_staff where user_id=uid and role='admin') then raise exception 'Administrator access required.'; end if;
 if action='save-settings' then
  update public.ryvo_economy_settings set
   universal_usd_cents=coalesce((payload->>'universalUsdCents')::int,universal_usd_cents),
   token_demand_target=coalesce((payload->>'tokenDemandTarget')::int,token_demand_target) where id=1;
  insert into public.ryvo_audit(actor,action,subject) values(uid,'economy:settings',payload::text);
  action:='report';
 end if;
 if action<>'report' then raise exception 'Invalid request.'; end if;
 return jsonb_build_object(
  'totals',(select jsonb_build_object('entries',count(*),'collected',coalesce(sum(amount_micro),0),'winners',coalesce(sum(winners_micro),0),
     'creators',coalesce(sum(creator_micro),0),'ryvo',coalesce(sum(ryvo_micro),0),'referrals',coalesce(sum(referral_micro),0),'pool',coalesce(sum(pool_micro),0))
    from public.ryvo_entry_splits),
  'launchFees',(select coalesce(sum(amount_micro),0) from public.ryvo_competition_payments where kind='launch' and status='paid'),
  'refundsDue',(select jsonb_build_object('count',count(*),'amount',coalesce(sum(amount_micro),0)) from public.ryvo_competition_payments where status='refund_due'),
  'competitions',coalesce((select jsonb_agg(q.r order by q.r->>'createdAt' desc) from (
    select jsonb_build_object('id',k.id,'title',k.definition->>'title','status',k.definition->>'status',
     'joined',coalesce((k.definition->>'joined')::int,0),'capacity',(k.definition->>'capacity')::int,'winners',(k.definition->>'winners')::int,
     'winnerShare',coalesce((k.definition->>'winnerShare')::numeric,public.ryvo_winner_share((k.definition->>'capacity')::int,(k.definition->>'winners')::int)),
     'collected',coalesce(sum(s.amount_micro),0),'winnersMicro',coalesce(sum(s.winners_micro),0),'creatorMicro',coalesce(sum(s.creator_micro),0),
     'ryvoMicro',coalesce(sum(s.ryvo_micro),0),'poolMicro',coalesce(sum(s.pool_micro),0),'createdAt',k.created_at) r
    from public.competitions k left join public.ryvo_entry_splits s on s.competition_id=k.id
    group by k.id) q),'[]'),
  'universal',jsonb_build_object(
    'tokenRate',public.ryvo_universal_token_rate(),
    'tokenSwaps24h',(select count(*) from public.ryvo_universal_swaps where kind='token' and created_at>now()-interval '24 hours'),
    'tokenMicro',(select coalesce(sum(token_micro),0) from public.ryvo_universal_swaps where kind='token'),
    'usdMicro',(select coalesce(sum(usd_micro),0) from public.ryvo_universal_swaps where kind='usd'),
    'activeListings',(select count(*) from public.ryvo_universal_listings where status='active'),
    'sold',(select count(*) from public.ryvo_universal_listings where status='sold')),
  'settings',(select jsonb_build_object('universalUsdCents',universal_usd_cents,'tokenDemandTarget',token_demand_target) from public.ryvo_economy_settings where id=1));
end $$;

revoke all on function public.ryvo_universal(text,jsonb), public.ryvo_economy(text,jsonb), public.ryvo_universal_token_rate() from public, anon;
grant execute on function public.ryvo_universal(text,jsonb), public.ryvo_economy(text,jsonb) to authenticated;
revoke all on function public.ryvo_winner_share(int,int) from public, anon;
grant execute on function public.ryvo_winner_share(int,int) to authenticated, service_role;
commit;
