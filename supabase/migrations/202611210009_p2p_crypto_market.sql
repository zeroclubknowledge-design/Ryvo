-- Run in Supabase SQL Editor after 202611190008_referral_tracking.sql.
-- P2P market: approved merchants post ads selling USDC or SOL for local
-- currency; players buy into their own Solana wallet. Flow, like an exchange's
-- P2P desk: order (amount reserved) → buyer pays merchant by bank transfer →
-- buyer marks paid → merchant releases from their wallet through Ryvo, which
-- builds and verifies the on-chain transfer → released. Disputes go to admins.
-- Units: USDC in micro (1e6), SOL in lamports (1e9); fiat in minor units.
begin;
do $$ begin
 if to_regclass('public.ryvo_merchants') is null then raise exception 'Run 202611160002_merchant_admin.sql in this Supabase project first.'; end if;
end $$;

create table if not exists public.ryvo_p2p_ads(
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references public.ryvo_merchants(user_id),
 asset text not null check(asset in ('USDC','SOL')),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 price_minor bigint not null check(price_minor between 1 and 100000000000),     -- fiat minor units per 1 whole USDC/SOL
 available_units bigint not null check(available_units>=0),
 reserved_units bigint not null default 0 check(reserved_units>=0),
 min_minor bigint not null check(min_minor>=1),
 max_minor bigint not null,
 window_minutes integer not null default 15 check(window_minutes between 10 and 60),
 terms text not null default '' check(length(terms)<=400),
 enabled boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(max_minor>=min_minor), check(reserved_units<=available_units),
 unique(merchant_id, asset, currency)
);
create table if not exists public.ryvo_p2p_orders(
 id uuid primary key default gen_random_uuid(),
 ad_id uuid not null references public.ryvo_p2p_ads(id),
 buyer_id uuid not null references auth.users(id),
 merchant_id uuid not null references public.ryvo_merchants(user_id),
 asset text not null, currency text not null, price_minor bigint not null,
 fiat_minor bigint not null check(fiat_minor>0), units bigint not null check(units>0),
 buyer_wallet text not null check(buyer_wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
 bank_name text not null, account_name text not null, account_number text not null,
 status text not null default 'awaiting_payment' check(status in ('awaiting_payment','paid','released','cancelled','expired','disputed')),
 reference text unique, release_signature text unique, merchant_wallet text,
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 paid_at timestamptz, released_at timestamptz, closed_reason text
);
create index if not exists ryvo_p2p_orders_buyer on public.ryvo_p2p_orders(buyer_id, created_at desc);
create index if not exists ryvo_p2p_orders_merchant on public.ryvo_p2p_orders(merchant_id, created_at desc);
alter table public.ryvo_p2p_ads enable row level security;
alter table public.ryvo_p2p_orders enable row level security;
revoke all on public.ryvo_p2p_ads, public.ryvo_p2p_orders from anon, authenticated;

-- Unpaid orders past their window expire and give their amount back to the ad.
create or replace function public.ryvo_p2p_expire() returns void language sql security definer set search_path='' as $$
 with gone as (update public.ryvo_p2p_orders set status='expired', closed_reason='Payment window closed'
   where status='awaiting_payment' and expires_at<now() returning ad_id, units)
 update public.ryvo_p2p_ads a set reserved_units=a.reserved_units-g.total, updated_at=now()
 from (select ad_id, sum(units) total from gone group by ad_id) g where a.id=g.ad_id;
$$;

create or replace function public.ryvo_p2p(action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); ad public.ryvo_p2p_ads; o public.ryvo_p2p_orders; m public.ryvo_merchants;
 fiat bigint; qty bigint; scale bigint; is_admin boolean; saved jsonb;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 perform public.ryvo_p2p_expire();
 select exists(select 1 from public.ryvo_staff where user_id=uid and role='admin') into is_admin;

 if action='market' then
  return coalesce((select jsonb_agg(jsonb_build_object(
     'id',a.id,'asset',a.asset,'currency',a.currency,'price',a.price_minor,'available',a.available_units-a.reserved_units,
     'min',a.min_minor,'max',a.max_minor,'window',a.window_minutes,'terms',a.terms,'merchant',mm.name,'mine',a.merchant_id=uid,
     'orders',(select count(*) from public.ryvo_p2p_orders x where x.merchant_id=a.merchant_id and x.status='released'),
     'completion',(select case when count(*)=0 then null else round(100.0*count(*) filter (where x.status='released')/count(*)) end
        from public.ryvo_p2p_orders x where x.merchant_id=a.merchant_id and x.status in ('released','cancelled','expired','disputed') and x.created_at>now()-interval '30 days'),
     'releaseMinutes',(select round(avg(extract(epoch from (x.released_at-x.paid_at))/60)) from public.ryvo_p2p_orders x where x.merchant_id=a.merchant_id and x.status='released' and x.paid_at is not null))
    order by a.price_minor)
   from public.ryvo_p2p_ads a join public.ryvo_merchants mm on mm.user_id=a.merchant_id
   where mm.status='approved' and a.enabled and a.asset=payload->>'asset' and a.currency=payload->>'currency'
     and a.available_units-a.reserved_units>0),'[]');
 end if;

 if action='create-order' then
  select * into ad from public.ryvo_p2p_ads where id=(payload->>'adId')::uuid for update;
  if not found or not ad.enabled then raise exception 'This ad is no longer available.'; end if;
  select * into m from public.ryvo_merchants where user_id=ad.merchant_id;
  if m.status<>'approved' then raise exception 'This merchant isn''t taking orders.'; end if;
  if ad.merchant_id=uid then raise exception 'You can''t buy from your own ad.'; end if;
  if (select count(*) from public.ryvo_p2p_orders where buyer_id=uid and status in ('awaiting_payment','paid','disputed'))>=3 then
   raise exception 'Finish your open orders before starting another.'; end if;
  fiat:=(payload->>'fiatMinor')::bigint;
  if fiat is null or fiat<ad.min_minor or fiat>ad.max_minor then raise exception 'Enter an amount within this ad''s limits.'; end if;
  scale:=case ad.asset when 'USDC' then 1000000 else 1000000000 end;
  qty:=floor(fiat::numeric*scale/ad.price_minor);
  if qty<=0 then raise exception 'That amount is too small.'; end if;
  if qty>ad.available_units-ad.reserved_units then raise exception 'The merchant doesn''t have that much available right now.'; end if;
  if coalesce(payload->>'wallet','') !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then raise exception 'Connect the Solana wallet to receive into.'; end if;
  update public.ryvo_p2p_ads set reserved_units=reserved_units+qty, updated_at=now() where id=ad.id;
  insert into public.ryvo_p2p_orders(ad_id,buyer_id,merchant_id,asset,currency,price_minor,fiat_minor,units,buyer_wallet,bank_name,account_name,account_number,expires_at)
  values(ad.id,uid,ad.merchant_id,ad.asset,ad.currency,ad.price_minor,fiat,qty,payload->>'wallet',m.bank_name,m.account_name,m.account_number,now()+make_interval(mins=>ad.window_minutes))
  returning * into o;
  return jsonb_build_object('id',o.id);
 end if;

 if action in ('mark-paid','cancel','dispute','merchant-cancel','admin-resolve') then
  select * into o from public.ryvo_p2p_orders where id=(payload->>'id')::uuid for update;
  if not found then raise exception 'Order not found.'; end if;
  if action='mark-paid' then
   if o.buyer_id<>uid then raise exception 'Order not found.'; end if;
   if o.status<>'awaiting_payment' then raise exception 'This order can''t be marked as paid now.'; end if;
   update public.ryvo_p2p_orders set status='paid',paid_at=now() where id=o.id;
  elsif action='cancel' then
   if o.buyer_id<>uid then raise exception 'Order not found.'; end if;
   if o.status<>'awaiting_payment' then raise exception 'Once you''ve marked an order paid, open an appeal instead of cancelling.'; end if;
   update public.ryvo_p2p_orders set status='cancelled',closed_reason='Cancelled by buyer' where id=o.id;
   update public.ryvo_p2p_ads set reserved_units=reserved_units-o.units, updated_at=now() where id=o.ad_id;
  elsif action='merchant-cancel' then
   if o.merchant_id<>uid then raise exception 'Order not found.'; end if;
   if o.status<>'awaiting_payment' then raise exception 'The buyer has marked this paid. Release it, or open an appeal.'; end if;
   update public.ryvo_p2p_orders set status='cancelled',closed_reason='Cancelled by merchant' where id=o.id;
   update public.ryvo_p2p_ads set reserved_units=reserved_units-o.units, updated_at=now() where id=o.ad_id;
  elsif action='dispute' then
   if uid not in (o.buyer_id,o.merchant_id) then raise exception 'Order not found.'; end if;
   if o.status<>'paid' then raise exception 'Appeals open once the order is marked paid.'; end if;
   update public.ryvo_p2p_orders set status='disputed',closed_reason=left(coalesce(payload->>'reason','Appeal opened'),300) where id=o.id;
  else
   if not is_admin then raise exception 'Administrator access required.'; end if;
   if o.status<>'disputed' then raise exception 'Only disputed orders are resolved here.'; end if;
   if payload->>'outcome'<>'cancelled' then raise exception 'Release disputed orders from the merchant studio; admins can only cancel.'; end if;
   update public.ryvo_p2p_orders set status='cancelled',closed_reason='Cancelled by admin after appeal' where id=o.id;
   update public.ryvo_p2p_ads set reserved_units=reserved_units-o.units, updated_at=now() where id=o.ad_id;
  end if;
  insert into public.ryvo_audit(actor,action,subject) values(uid,'p2p:'||action,o.id::text);
  return jsonb_build_object('status','ok');
 end if;

 if action='my-orders' then
  return coalesce((select jsonb_agg(to_jsonb(x)-'reference'||jsonb_build_object('merchant',(select name from public.ryvo_merchants where user_id=x.merchant_id))
   order by x.created_at desc) from (select * from public.ryvo_p2p_orders where buyer_id=uid order by created_at desc limit 30) x),'[]');
 end if;

 -- Merchant studio --------------------------------------------------------
 select * into m from public.ryvo_merchants where user_id=uid;
 if action='merchant-ads' then
  if not found then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(to_jsonb(a) order by a.asset, a.currency) from public.ryvo_p2p_ads a where a.merchant_id=uid),'[]');
 end if;
 if action='save-ad' then
  if not found or m.status<>'approved' then raise exception 'Only approved merchants can post ads.'; end if;
  if payload->>'asset' not in ('USDC','SOL') or coalesce(payload->>'currency','') !~ '^[A-Z]{3}$' then raise exception 'Choose an asset and a currency.'; end if;
  insert into public.ryvo_p2p_ads(merchant_id,asset,currency,price_minor,available_units,min_minor,max_minor,window_minutes,terms,enabled)
  values(uid,payload->>'asset',payload->>'currency',(payload->>'price')::bigint,(payload->>'available')::bigint,(payload->>'min')::bigint,(payload->>'max')::bigint,
   coalesce((payload->>'window')::int,15),coalesce(payload->>'terms',''),coalesce((payload->>'enabled')::boolean,true))
  on conflict(merchant_id,asset,currency) do update set price_minor=excluded.price_minor,
   available_units=greatest(excluded.available_units, public.ryvo_p2p_ads.reserved_units),
   min_minor=excluded.min_minor,max_minor=excluded.max_minor,window_minutes=excluded.window_minutes,terms=excluded.terms,enabled=excluded.enabled,updated_at=now()
  returning to_jsonb(public.ryvo_p2p_ads.*) into saved;
  return saved;
 end if;
 if action='merchant-orders' then
  if not found and not is_admin then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(to_jsonb(x)-'reference' order by x.created_at desc)
   from (select * from public.ryvo_p2p_orders where merchant_id=uid or (is_admin and payload->>'scope'='disputes' and status='disputed') order by created_at desc limit 50) x),'[]');
 end if;
 raise exception 'Invalid request.';
end $$;

-- Server-only: set the release reference, and record a verified release.
create or replace function public.ryvo_p2p_release_ref(order_id uuid, merchant uuid, ref text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.ryvo_p2p_orders;
begin
 select * into o from public.ryvo_p2p_orders where id=order_id for update;
 if not found or o.merchant_id<>merchant then raise exception 'Order not found.'; end if;
 if o.status not in ('paid','disputed') then raise exception 'Release once the buyer has marked the order paid.'; end if;
 update public.ryvo_p2p_orders set reference=ref where id=o.id;
 return jsonb_build_object('asset',o.asset,'units',o.units,'buyerWallet',o.buyer_wallet);
end $$;
create or replace function public.ryvo_p2p_mark_released(order_id uuid, sig text, wallet text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.ryvo_p2p_orders;
begin
 select * into o from public.ryvo_p2p_orders where id=order_id for update;
 if not found then raise exception 'Order not found.'; end if;
 if o.status='released' then return jsonb_build_object('status','released'); end if;
 if o.status not in ('paid','disputed') then raise exception 'This order can''t be released now.'; end if;
 update public.ryvo_p2p_orders set status='released',released_at=now(),release_signature=sig,merchant_wallet=wallet where id=o.id;
 update public.ryvo_p2p_ads set reserved_units=reserved_units-o.units, available_units=available_units-o.units, updated_at=now() where id=o.ad_id;
 insert into public.ryvo_audit(actor,action,subject) values(o.merchant_id,'p2p:released',o.id::text);
 return jsonb_build_object('status','released');
end $$;

revoke all on function public.ryvo_p2p(text,jsonb), public.ryvo_p2p_expire(), public.ryvo_p2p_release_ref(uuid,uuid,text), public.ryvo_p2p_mark_released(uuid,text,text) from public, anon;
grant execute on function public.ryvo_p2p(text,jsonb) to authenticated;
revoke all on function public.ryvo_p2p_release_ref(uuid,uuid,text), public.ryvo_p2p_mark_released(uuid,text,text) from authenticated;
grant execute on function public.ryvo_p2p_release_ref(uuid,uuid,text), public.ryvo_p2p_mark_released(uuid,text,text) to service_role;
revoke all on function public.ryvo_p2p_expire() from authenticated;
commit;
