-- Run in Supabase SQL Editor after 202611190007_competition_economy.sql.
-- Referral tracking: a new account is linked to the player whose invite link
-- it came from, once, when the account is created. Referred entries then pay
-- the referrer their rate as a share of Ryvo's 50%, and every fifth
-- qualifying referral (a referred player's first paid entry) earns a
-- Universal piece.
begin;
do $$ begin
 if to_regclass('public.ryvo_entry_splits') is null then
  raise exception 'Run 202611190007_competition_economy.sql in this Supabase project first.';
 end if;
end $$;

create table if not exists public.ryvo_referrals(
 referred_id uuid primary key references auth.users(id) on delete cascade,
 referrer_id uuid not null references auth.users(id) on delete cascade,
 via_username text not null,
 created_at timestamptz not null default now(),
 check(referred_id<>referrer_id)
);
create index if not exists ryvo_referrals_referrer on public.ryvo_referrals(referrer_id);
alter table public.ryvo_referrals enable row level security;
revoke all on public.ryvo_referrals from anon, authenticated;

-- Link at sign-up only (insert trigger), so editing account details later can't move a referral.
create or replace function public.ryvo_link_referral() returns trigger language plpgsql security definer set search_path='' as $$
declare handle text:=lower(trim(coalesce(new.raw_user_meta_data->>'referred_by','')));
 own text:=lower(trim(coalesce(new.raw_user_meta_data->>'username',''))); referrer uuid;
begin
 if handle !~ '^[a-z0-9_.]{3,24}$' or handle=own then return new; end if;
 select u.id into referrer from auth.users u
  where lower(u.raw_user_meta_data->>'username')=handle and u.id<>new.id order by u.created_at limit 1;
 if referrer is not null then
  insert into public.ryvo_referrals(referred_id,referrer_id,via_username) values(new.id,referrer,handle) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.ryvo_link_referral() from public, anon, authenticated;
drop trigger if exists ryvo_link_referral on auth.users;
create trigger ryvo_link_referral after insert on auth.users for each row execute function public.ryvo_link_referral();

-- The referrer's commission rate (10–50), from the programme they chose:
-- 'level' follows boards completed; otherwise Ryvo's total player count.
create or replace function public.ryvo_referral_rate(referrer uuid) returns int
language plpgsql stable security definer set search_path='' as $$
declare scheme text; boards int; lvl int; players bigint;
begin
 select raw_user_meta_data->>'referral_scheme' into scheme from auth.users where id=referrer;
 if scheme='level' then
  select count(*) into boards from public.player_boards b join public.competitions c on c.id=b.competition_id
   where b.user_id=referrer and (select count(distinct x) from unnest(b.pieces) x)>=coalesce((c.definition->>'total')::int,2147483647);
  lvl:=case when boards>=25 then 10 when boards>=20 then 9 when boards>=16 then 8 when boards>=12 then 7 when boards>=9 then 6
            when boards>=6 then 5 when boards>=4 then 4 when boards>=2 then 3 when boards>=1 then 2 else 1 end;
  return case when lvl<=2 then 10 when lvl<=4 then 20 when lvl<=6 then 30 when lvl<=8 then 40 else 50 end;
 end if;
 select count(*) into players from public.wallets;
 return case when players<10000 then 50 when players<100000 then 30 when players<1000000 then 20 else 10 end;
end $$;
revoke all on function public.ryvo_referral_rate(uuid) from public, anon, authenticated;

-- A player's own referral numbers for the Invite page.
create or replace function public.ryvo_my_referrals() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'joined',(select count(*) from public.ryvo_referrals where referrer_id=auth.uid()),
  'qualifying',(select count(*) from public.ryvo_referrals r where r.referrer_id=auth.uid() and exists(select 1 from public.competition_entries e where e.user_id=r.referred_id)),
  'earnedMicro',(select coalesce(sum(referral_micro),0) from public.ryvo_entry_splits where referrer_id=auth.uid()),
  'rate',public.ryvo_referral_rate(auth.uid()))
$$;
revoke all on function public.ryvo_my_referrals() from public, anon;
grant execute on function public.ryvo_my_referrals() to authenticated;

-- Record a payment the server has confirmed on Solana. Safe to call twice.
create or replace function public.ryvo_settle_competition_payment(payment uuid,sig text,payer_wallet text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.ryvo_competition_payments; c public.competitions; d jsonb; issued bigint; joined int; cap int; display text; share numeric; ryvo bigint; winners_part bigint; creator_part bigint; ref_id uuid; ref_rate int; ref_part bigint; qualifying int;
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
 -- Referral reward: the referrer's rate, as a share of Ryvo's 50%, paid to their USDC earnings.
 select r.referrer_id into ref_id from public.ryvo_referrals r where r.referred_id=p.user_id;
 if ref_id is not null then
  ref_rate:=public.ryvo_referral_rate(ref_id);
  ref_part:=round(ryvo*ref_rate/100.0);
  update public.ryvo_entry_splits set referrer_id=ref_id,referral_micro=ref_part where payment_id=p.id;
  if ref_part>0 then
   insert into public.ryvo_usdc_entries(user_id,amount_micro,kind,reference) values(ref_id,ref_part,'earning','referral:'||p.id);
   insert into public.ryvo_usdc_earnings(user_id,available_micro) values(ref_id,ref_part) on conflict(user_id) do update set available_micro=public.ryvo_usdc_earnings.available_micro+excluded.available_micro;
  end if;
  -- A referral qualifies on the referred player's first paid entry; every fifth earns a Universal piece.
  if (select count(*) from public.competition_entries where user_id=p.user_id)=1 then
   select count(*) into qualifying from public.ryvo_referrals r where r.referrer_id=ref_id and exists(select 1 from public.competition_entries e where e.user_id=r.referred_id);
   if qualifying>0 and qualifying%5=0 then
    insert into public.ryvo_universal_entitlements(user_id,source,source_reference,issued_at,expires_at)
    values(ref_id,'referral','referral-milestone:'||ref_id||':'||qualifying,now(),now()+interval '720 hours') on conflict do nothing;
   end if;
  end if;
 end if;
 joined:=joined+1;
 update public.competitions set definition=definition||jsonb_build_object('joined',joined)
  ||case when joined>=cap then jsonb_build_object('status','active','startedAt',now(),'endsAt',now()+interval '1 month') else '{}'::jsonb end
 where id=c.id;
 return jsonb_build_object('status','paid','competitionId',p.competition_id,'credits',issued);
end $$;

revoke all on function public.ryvo_settle_competition_payment(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ryvo_settle_competition_payment(uuid,text,text) to service_role;
commit;
