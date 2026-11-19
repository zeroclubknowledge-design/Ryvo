-- Run after the previous Ryvo migrations. Old naira/credit balances are NOT USDC.
begin;
do $$ begin
 if to_regclass('public.ryvo_merchants') is null or to_regclass('public.ryvo_ops_settings') is null then
  raise exception 'Run 202611160001_ryvo_foundation.sql and 202611160002_merchant_admin.sql in this Supabase project first.';
 end if;
end $$;
do $$ begin
 if to_regprocedure('public.ryvo_credit_operation_legacy(text,jsonb)') is null then
  alter function public.ryvo_operation(text,jsonb) rename to ryvo_credit_operation_legacy;
 end if;
end $$;
revoke all on function public.ryvo_credit_operation_legacy(text,jsonb) from public,anon,authenticated;
create or replace function public.ryvo_operation(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if action not in ('workspace','review-merchant','moderate-competition') then raise exception 'Credit funding and wholesale trading have been retired. P2P is now USDC cash-out only.'; end if;
 return public.ryvo_credit_operation_legacy(action,payload);
end $$;
revoke all on function public.ryvo_operation(text,jsonb) from public,anon;
grant execute on function public.ryvo_operation(text,jsonb) to authenticated;
update public.ryvo_ops_settings set manual_enabled=false where id=1;

create table if not exists public.ryvo_wallet_connections(user_id uuid primary key references auth.users(id),address text not null unique check(address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),verified_at timestamptz not null default now());
create table if not exists public.ryvo_wallet_challenges(id uuid primary key default gen_random_uuid(),user_id uuid not null unique references auth.users(id),address text not null,message text not null,expires_at timestamptz not null,used boolean not null default false);
create table if not exists public.ryvo_usdc_earnings(user_id uuid primary key references auth.users(id),available_micro bigint not null default 0 check(available_micro between 0 and 1000000000000000),reserved_micro bigint not null default 0 check(reserved_micro between 0 and 1000000000000000));
create table if not exists public.ryvo_usdc_entries(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),amount_micro bigint not null,kind text not null check(kind in ('earning','cashout','refund')),reference text not null unique,signature text,created_at timestamptz not null default now());
create table if not exists public.ryvo_cashout_settings(id integer primary key check(id=1),enabled boolean not null default false);
insert into public.ryvo_cashout_settings(id) values(1) on conflict do nothing;
create table if not exists public.ryvo_cashout_offers(id uuid primary key default gen_random_uuid(),merchant_id uuid not null references public.ryvo_merchants(user_id),country text not null,currency text not null,rate numeric(18,6) not null check(rate>0 and rate<=10000000),minor_digits integer not null check(minor_digits between 0 and 2),minimum_micro bigint not null check(minimum_micro>=1000000),maximum_micro bigint not null check(maximum_micro>=minimum_micro and maximum_micro<=1000000000000),capacity_minor bigint not null check(capacity_minor>=0),reserved_minor bigint not null default 0 check(reserved_minor>=0 and reserved_minor<=capacity_minor),enabled boolean not null default false,unique(merchant_id,country));
create table if not exists public.ryvo_cashout_orders(id uuid primary key default gen_random_uuid(),request_id uuid not null unique,user_id uuid not null references auth.users(id),merchant_id uuid not null references public.ryvo_merchants(user_id),offer_id uuid not null references public.ryvo_cashout_offers(id),merchant_name text not null,user_wallet text not null,merchant_wallet text not null,arbiter_wallet text,amount_micro bigint not null check(amount_micro>0),payout_minor bigint not null check(payout_minor>0),country text not null,currency text not null,rate numeric(18,6) not null,bank_name text not null,account_name text not null,account_number text not null,status text not null default 'awaiting_escrow' check(status in ('awaiting_escrow','escrow_pending','escrow_locked','merchant_accepted','fiat_sent','disputed','completed','refunded','cancelled')),payout_reference text,deposit_signature text unique,settlement_signature text unique,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '10 minutes');
create index if not exists ryvo_cashout_user on public.ryvo_cashout_orders(user_id,created_at desc);
create index if not exists ryvo_cashout_merchant on public.ryvo_cashout_orders(merchant_id,created_at desc);
create unique index if not exists ryvo_cashout_payment_reference on public.ryvo_cashout_orders(merchant_id,payout_reference) where payout_reference is not null;
create table if not exists public.ryvo_universal_entitlements(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),source text not null check(source in ('welcome','referral')),source_reference text not null unique,issued_at timestamptz not null,expires_at timestamptz not null,redeemed_at timestamptz,check(expires_at=issued_at+interval '720 hours'));
insert into public.ryvo_universal_entitlements(user_id,source,source_reference,issued_at,expires_at) select id,'welcome','welcome:'||id,created_at,created_at+interval '720 hours' from auth.users on conflict(source_reference) do nothing;
create or replace function public.ryvo_welcome_entitlement() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.ryvo_universal_entitlements(user_id,source,source_reference,issued_at,expires_at) values(new.id,'welcome','welcome:'||new.id,new.created_at,new.created_at+interval '720 hours') on conflict do nothing;return new;
end $$;
revoke all on function public.ryvo_welcome_entitlement() from public,anon,authenticated;
drop trigger if exists ryvo_welcome_entitlement on auth.users;
create trigger ryvo_welcome_entitlement after insert on auth.users for each row execute function public.ryvo_welcome_entitlement();
alter table public.ryvo_wallet_connections enable row level security;
alter table public.ryvo_wallet_challenges enable row level security;
alter table public.ryvo_usdc_earnings enable row level security;
alter table public.ryvo_usdc_entries enable row level security;
alter table public.ryvo_cashout_settings enable row level security;
alter table public.ryvo_cashout_offers enable row level security;
alter table public.ryvo_cashout_orders enable row level security;
alter table public.ryvo_universal_entitlements enable row level security;
revoke all on public.ryvo_wallet_connections,public.ryvo_wallet_challenges,public.ryvo_usdc_earnings,public.ryvo_usdc_entries,public.ryvo_cashout_settings,public.ryvo_cashout_offers,public.ryvo_cashout_orders,public.ryvo_universal_entitlements from public,anon,authenticated;

create or replace function public.ryvo_wallet_challenge(address text,origin text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); challenge uuid:=gen_random_uuid();msg text;
begin
 if uid is null then raise exception 'Sign in first.';end if;
 if address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' or length(origin)>250 then raise exception 'Invalid wallet request.';end if;
 msg:='Ryvo wallet verification'||chr(10)||'Origin: '||origin||chr(10)||'Account: '||uid||chr(10)||'Wallet: '||address||chr(10)||'Nonce: '||challenge||chr(10)||'This signature links your wallet. It does not transfer funds.';
 insert into public.ryvo_wallet_challenges(id,user_id,address,message,expires_at) values(challenge,uid,address,msg,now()+interval '5 minutes') on conflict(user_id) do update set id=excluded.id,address=excluded.address,message=excluded.message,expires_at=excluded.expires_at,used=false;
 return jsonb_build_object('id',challenge,'message',msg);
end $$;
create or replace function public.ryvo_read_wallet_challenge(challenge uuid) returns jsonb language sql security definer set search_path='' as $$select to_jsonb(c) from public.ryvo_wallet_challenges c where c.id=challenge and c.user_id=auth.uid() and not c.used and c.expires_at>now()$$;
create or replace function public.ryvo_link_verified_wallet(challenge uuid,actor uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.ryvo_wallet_challenges;
begin
 select * into c from public.ryvo_wallet_challenges where id=challenge and user_id=actor and not used and expires_at>now() for update;
 if not found then raise exception 'Wallet challenge expired or already used.';end if;
 if exists(select 1 from public.ryvo_cashout_orders where user_id=actor and status not in ('completed','refunded','cancelled')) then raise exception 'Finish your cash-out orders before changing wallets.';end if;
 insert into public.ryvo_wallet_connections(user_id,address) values(actor,c.address) on conflict(user_id) do update set address=excluded.address,verified_at=now();
 update public.ryvo_wallet_challenges set used=true where id=c.id;
end $$;
revoke all on function public.ryvo_wallet_challenge(text,text),public.ryvo_read_wallet_challenge(uuid) from public,anon;
grant execute on function public.ryvo_wallet_challenge(text,text),public.ryvo_read_wallet_challenge(uuid) to authenticated;
revoke all on function public.ryvo_link_verified_wallet(uuid,uuid) from public,anon,authenticated;
grant execute on function public.ryvo_link_verified_wallet(uuid,uuid) to service_role;

create or replace function public.ryvo_cashout_directory() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'merchant_id',o.merchant_id,'merchant_name',m.name,'country',o.country,'currency',o.currency,'rate',o.rate,'minimum_micro',o.minimum_micro,'maximum_micro',o.maximum_micro,'available_minor',o.capacity_minor-o.reserved_minor)),'[]'::jsonb)
 from public.ryvo_cashout_offers o join public.ryvo_merchants m on m.user_id=o.merchant_id join public.ryvo_wallet_connections w on w.user_id=m.user_id
 where o.enabled and m.status='approved' and o.capacity_minor>o.reserved_minor and exists(select 1 from public.ryvo_cashout_settings where enabled)
$$;
revoke all on function public.ryvo_cashout_directory() from public;
grant execute on function public.ryvo_cashout_directory() to anon,authenticated;

create or replace function public.ryvo_cashout(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();is_admin boolean;offer public.ryvo_cashout_offers;ord public.ryvo_cashout_orders;wallet text;merchant_wallet text;country_code text;currency_code text;digits integer;amount bigint;payout bigint;result jsonb;base jsonb;
begin
 if uid is null then raise exception 'Sign in to continue.' using errcode='42501';end if;
 select exists(select 1 from public.ryvo_staff where user_id=uid) into is_admin;
 -- Auth identities are server-verified. Editable user_metadata is never wallet proof.
 select i.identity_data->>'address' into wallet from auth.identities i where i.user_id=uid and i.provider='web3' and i.identity_data->>'chain'='solana' limit 1;
 if wallet is not null and not exists(select 1 from public.ryvo_wallet_connections where user_id=uid) then insert into public.ryvo_wallet_connections(user_id,address) values(uid,wallet) on conflict do nothing;end if;
 select address into wallet from public.ryvo_wallet_connections where user_id=uid;
 insert into public.ryvo_usdc_earnings(user_id) values(uid) on conflict do nothing;
 if action='workspace' then
  base:=public.ryvo_credit_operation_legacy('workspace','{}');
  return jsonb_build_object('admin',is_admin,'merchant',base->'merchant','merchants',base->'merchants','players',base->'players','competitions',base->'competitions','audit',base->'audit','wallet',wallet,
   'earnings',(select to_jsonb(e) from public.ryvo_usdc_earnings e where user_id=uid),
   'settings',(select to_jsonb(s) from public.ryvo_cashout_settings s where id=1),
   'offers',(select coalesce(jsonb_agg(to_jsonb(o)),'[]') from public.ryvo_cashout_offers o where is_admin or merchant_id=uid),
   'orders',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from public.ryvo_cashout_orders where is_admin or user_id=uid or merchant_id=uid order by created_at desc limit 200) x),
   'entitlements',(select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('status',case when redeemed_at is not null then 'redeemed' when expires_at<=now() then 'expired' else 'available' end)),'[]') from public.ryvo_universal_entitlements e where user_id=uid),'server_time',now());
 elsif action='save-offer' then
  if not exists(select 1 from public.ryvo_merchants where user_id=uid and status='approved') or wallet is null then raise exception 'An approved merchant account and verified Solana wallet are required.';end if;
  country_code:=payload->>'country';
  select code,currency,precision into country_code,currency_code,digits from (values('NG','NGN',2),('GH','GHS',2),('KE','KES',2),('ZA','ZAR',2),('UG','UGX',0),('TZ','TZS',2),('GB','GBP',2),('US','USD',2),('CA','CAD',2),('DE','EUR',2),('FR','EUR',2)) c(code,currency,precision) where code=country_code;
  if currency_code is null then raise exception 'Choose a supported payout country.';end if;
  insert into public.ryvo_cashout_offers(merchant_id,country,currency,minor_digits,rate,minimum_micro,maximum_micro,capacity_minor,enabled) values(uid,country_code,currency_code,digits,(payload->>'rate')::numeric,(payload->>'minimum_micro')::bigint,(payload->>'maximum_micro')::bigint,(payload->>'capacity_minor')::bigint,coalesce((payload->>'enabled')::boolean,false)) on conflict(merchant_id,country) do update set rate=excluded.rate,minimum_micro=excluded.minimum_micro,maximum_micro=excluded.maximum_micro,capacity_minor=excluded.capacity_minor,enabled=excluded.enabled;
 elsif action='set-enabled' then
  if not is_admin then raise exception 'Administrator access required.';end if;
  update public.ryvo_cashout_settings set enabled=coalesce((payload->>'enabled')::boolean,false) where id=1;
 elsif action='create-order' then
  if not exists(select 1 from public.ryvo_cashout_settings where enabled) then raise exception 'Cash-out is currently paused.';end if;
  if wallet is null then raise exception 'Verify your Solana wallet first.';end if;
  select to_jsonb(t) into result from public.ryvo_cashout_orders t where request_id=(payload->>'request_id')::uuid and user_id=uid;
  if result is not null then return result;end if;
  select * into offer from public.ryvo_cashout_offers where id=(payload->>'offer_id')::uuid and enabled for update;
  if not found or offer.merchant_id=uid or not exists(select 1 from public.ryvo_merchants where user_id=offer.merchant_id and status='approved') then raise exception 'Offer unavailable.';end if;
  select address into merchant_wallet from public.ryvo_wallet_connections where user_id=offer.merchant_id;
  if merchant_wallet is null then raise exception 'Merchant wallet unavailable.';end if;
  amount:=(payload->>'amount_micro')::bigint;
  if amount is null or amount<offer.minimum_micro or amount>offer.maximum_micro then raise exception 'Choose an amount within the merchant limits.';end if;
  if length(trim(coalesce(payload->>'bank_name','')))<2 or length(payload->>'bank_name')>80 or length(trim(coalesce(payload->>'account_name','')))<2 or length(payload->>'account_name')>100 or length(trim(coalesce(payload->>'account_number','')))<3 or length(payload->>'account_number')>64 then raise exception 'Enter the recipient bank and account details.';end if;
  payout:=floor(amount::numeric*offer.rate*power(10,offer.minor_digits)/1000000)::bigint;
  if payout<=0 or payout>offer.capacity_minor-offer.reserved_minor then raise exception 'The merchant does not have enough remaining payout capacity.';end if;
  perform 1 from public.ryvo_usdc_earnings where user_id=uid and available_micro>=amount for update;
  if not found then raise exception 'Not enough eligible USDC earnings. Credit and old naira balances cannot be cashed out as USDC.';end if;
  if (select count(*) from public.ryvo_cashout_orders where user_id=uid and status not in ('completed','refunded','cancelled'))>=3 then raise exception 'Finish your current cash-out orders first.';end if;
  update public.ryvo_usdc_earnings set available_micro=available_micro-amount,reserved_micro=reserved_micro+amount where user_id=uid;
  update public.ryvo_cashout_offers set reserved_minor=reserved_minor+payout where id=offer.id;
  insert into public.ryvo_cashout_orders(request_id,user_id,merchant_id,offer_id,merchant_name,user_wallet,merchant_wallet,amount_micro,payout_minor,country,currency,rate,bank_name,account_name,account_number) values((payload->>'request_id')::uuid,uid,offer.merchant_id,offer.id,(select name from public.ryvo_merchants where user_id=offer.merchant_id),wallet,merchant_wallet,amount,payout,offer.country,offer.currency,offer.rate,trim(payload->>'bank_name'),trim(payload->>'account_name'),trim(payload->>'account_number')) returning to_jsonb(ryvo_cashout_orders.*) into result;
 elsif action in ('cancel-order','report-payout','dispute-order') then
  select * into ord from public.ryvo_cashout_orders where id=(payload->>'id')::uuid for update;
  if not found or not(is_admin or ord.user_id=uid or ord.merchant_id=uid) then raise exception 'Order unavailable.';end if;
  if action='cancel-order' then
   if ord.status='cancelled' then return to_jsonb(ord);end if;
   if ord.status<>'awaiting_escrow' then raise exception 'Funded escrow cannot be cancelled in the database. Use the on-chain refund or dispute flow.';end if;
   update public.ryvo_usdc_earnings set available_micro=available_micro+ord.amount_micro,reserved_micro=reserved_micro-ord.amount_micro where user_id=ord.user_id;
   update public.ryvo_cashout_offers set reserved_minor=reserved_minor-ord.payout_minor where id=ord.offer_id;
   update public.ryvo_cashout_orders set status='cancelled' where id=ord.id;
  elsif action='report-payout' then
   if uid<>ord.merchant_id or not exists(select 1 from public.ryvo_merchants where user_id=uid and status='approved') then raise exception 'Only the approved merchant can report a payout.';end if;
   if ord.status<>'merchant_accepted' then raise exception 'Accept the funded escrow on-chain before sending local currency.';end if;
   if length(trim(coalesce(payload->>'reference','')))<6 or length(payload->>'reference')>100 then raise exception 'Enter the bank payout reference.';end if;
   update public.ryvo_cashout_orders set payout_reference=trim(payload->>'reference') where id=ord.id;
  else
   if ord.status not in ('escrow_locked','merchant_accepted','fiat_sent') then raise exception 'Only a funded cash-out can be disputed.';end if;
   update public.ryvo_cashout_orders set status='disputed' where id=ord.id;
  end if;
 else raise exception 'Unknown cash-out action.';end if;
 insert into public.ryvo_audit(actor,action,subject) values(uid,'cashout:'||action,coalesce(payload->>'id',payload->>'request_id',uid::text));
 return coalesce(result,jsonb_build_object('ok',true));
end $$;
revoke all on function public.ryvo_cashout(text,jsonb) from public,anon;
grant execute on function public.ryvo_cashout(text,jsonb) to authenticated;

-- Reconciliation is server-only, after independent verification of program state and finalized transactions.
create or replace function public.ryvo_reconcile_cashout(order_id uuid,event text,signature text) returns void language plpgsql security definer set search_path='' as $$
declare o public.ryvo_cashout_orders;
begin
 if length(signature)<64 or length(signature)>100 then raise exception 'Invalid transaction signature.';end if;
 select * into o from public.ryvo_cashout_orders where id=order_id for update;if not found then raise exception 'Order not found.';end if;
 if event='locked' then
  if o.deposit_signature=signature then return;end if;
  if o.status<>'escrow_pending' then raise exception 'Order is not awaiting its prepared escrow.';end if;
  update public.ryvo_cashout_orders set status='escrow_locked',deposit_signature=signature where id=o.id;
 elsif event='paid' then
  if o.status='fiat_sent' then return;end if;
  if o.status<>'merchant_accepted' or o.payout_reference is null then raise exception 'Report the bank payout before confirming the chain payment marker.';end if;
  update public.ryvo_cashout_orders set status='fiat_sent' where id=o.id;
 elsif event='disputed' then
  if o.status not in ('escrow_locked','merchant_accepted','fiat_sent','disputed') then raise exception 'Cannot dispute unfunded escrow.';end if;
  update public.ryvo_cashout_orders set status='disputed' where id=o.id;
 elsif event='accepted' then
  if o.status='merchant_accepted' then return;end if;
  if o.status<>'escrow_locked' then raise exception 'Escrow is not ready for merchant acceptance.';end if;
  update public.ryvo_cashout_orders set status='merchant_accepted' where id=o.id;
 elsif event in ('released','refunded') then
  if o.settlement_signature=signature then return;end if;
  if o.status not in ('escrow_locked','merchant_accepted','fiat_sent','disputed') then raise exception 'Escrow is not funded.';end if;
  update public.ryvo_usdc_earnings set reserved_micro=reserved_micro-o.amount_micro,available_micro=available_micro+case when event='refunded' then o.amount_micro else 0 end where user_id=o.user_id;
  update public.ryvo_cashout_offers set reserved_minor=reserved_minor-o.payout_minor,capacity_minor=capacity_minor-case when event='released' then o.payout_minor else 0 end where id=o.offer_id;
  update public.ryvo_cashout_orders set status=case when event='released' then 'completed' else 'refunded' end,settlement_signature=signature where id=o.id;
  insert into public.ryvo_usdc_entries(user_id,amount_micro,kind,reference,signature) values(o.user_id,case when event='released' then -o.amount_micro else o.amount_micro end,case when event='released' then 'cashout' else 'refund' end,'cashout:'||o.id,signature);
 else raise exception 'Invalid escrow event.';end if;
end $$;
revoke all on function public.ryvo_reconcile_cashout(uuid,text,text) from public,anon,authenticated;
grant execute on function public.ryvo_reconcile_cashout(uuid,text,text) to service_role;
create or replace function public.ryvo_prepare_cashout(order_id uuid,actor uuid,arbiter text) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.ryvo_cashout_orders;result jsonb;
begin
 select * into o from public.ryvo_cashout_orders where id=order_id and user_id=actor for update;
 if not found or o.status not in ('awaiting_escrow','escrow_pending') or o.expires_at<=now() then raise exception 'This cash-out quote is not available for deposit.';end if;
 if o.arbiter_wallet is not null and o.arbiter_wallet<>arbiter then raise exception 'The arbiter changed. Wait for this quote to expire before cancelling.';end if;
 update public.ryvo_cashout_orders set status='escrow_pending',arbiter_wallet=arbiter where id=o.id returning to_jsonb(ryvo_cashout_orders.*) into result;
 return result;
end $$;
revoke all on function public.ryvo_prepare_cashout(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.ryvo_prepare_cashout(uuid,uuid,text) to service_role;
create or replace function public.ryvo_record_usdc_earning(actor uuid,amount bigint,source_reference text,signature text) returns void language plpgsql security definer set search_path='' as $$
begin
 if amount is null or amount<=0 or amount>1000000000000 or length(source_reference)<6 or length(signature)<64 then raise exception 'Invalid verified earning.';end if;
 insert into public.ryvo_usdc_entries(user_id,amount_micro,kind,reference,signature) values(actor,amount,'earning','earning:'||source_reference,signature) on conflict(reference) do nothing;
 if found then insert into public.ryvo_usdc_earnings(user_id,available_micro) values(actor,amount) on conflict(user_id) do update set available_micro=ryvo_usdc_earnings.available_micro+excluded.available_micro;end if;
end $$;
revoke all on function public.ryvo_record_usdc_earning(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.ryvo_record_usdc_earning(uuid,bigint,text,text) to service_role;
create or replace function public.ryvo_cancel_unfunded_cashout(order_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.ryvo_cashout_orders;
begin
 select * into o from public.ryvo_cashout_orders where id=order_id for update;
 if not found or o.status<>'escrow_pending' or o.expires_at>=now() then raise exception 'Prepared escrow is not eligible for cancellation.';end if;
 update public.ryvo_usdc_earnings set available_micro=available_micro+o.amount_micro,reserved_micro=reserved_micro-o.amount_micro where user_id=o.user_id;
 update public.ryvo_cashout_offers set reserved_minor=reserved_minor-o.payout_minor where id=o.offer_id;
 update public.ryvo_cashout_orders set status='cancelled' where id=o.id;
end $$;
revoke all on function public.ryvo_cancel_unfunded_cashout(uuid) from public,anon,authenticated;
grant execute on function public.ryvo_cancel_unfunded_cashout(uuid) to service_role;
commit;
