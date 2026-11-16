-- Run AFTER 202611160001_ryvo_foundation.sql. Preserves existing balances.
begin;
create table if not exists public.ryvo_staff (
 user_id uuid primary key references auth.users(id), role text not null check(role='admin')
);
create table if not exists public.ryvo_merchants (
 user_id uuid primary key references auth.users(id), name text not null check(length(name) between 2 and 60),
 status text not null default 'pending' check(status in ('pending','approved','suspended')),
 bank_name text not null, account_name text not null, account_number text not null check(account_number ~ '^[0-9]{10}$'),
 credits bigint not null default 0 check(credits between 0 and 1000000000000),
 rate integer not null default 10 check(rate between 1 and 1000),
 minimum integer not null default 1000 check(minimum>=100), maximum integer not null default 100000 check(maximum>=minimum and maximum<=10000000),
 online boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.ryvo_trade_orders (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 buyer_id uuid not null references auth.users(id), merchant_id uuid not null references public.ryvo_merchants(user_id),
 merchant_name text not null, buyer_name text not null, amount bigint not null check(amount between 100 and 10000000),
 credits bigint not null check(credits between 1 and 1000000000000),
 bank_name text not null, account_name text not null, account_number text not null,
 status text not null default 'awaiting_payment' check(status in ('awaiting_payment','payment_reported','completed','cancelled','disputed')),
 payment_reference text,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '15 minutes'
);
create index if not exists ryvo_trade_buyer on public.ryvo_trade_orders(buyer_id,created_at desc);
create index if not exists ryvo_trade_merchant on public.ryvo_trade_orders(merchant_id,created_at desc);
create table if not exists public.ryvo_stock_requests (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique,
 merchant_id uuid not null references public.ryvo_merchants(user_id), merchant_name text not null,
 credits bigint not null check(credits between 1000 and 10000000), amount bigint not null check(amount>0), rate integer not null,
 bank_name text not null, account_name text not null, account_number text not null,
 status text not null default 'pending' check(status in ('pending','completed','rejected')),
 reference text, created_at timestamptz not null default now()
);
create table if not exists public.ryvo_payment_receipts (
 reference text primary key, subject uuid not null unique, verified_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.ryvo_audit (
 id bigint generated always as identity primary key, actor uuid not null references auth.users(id),
 action text not null, subject text not null, created_at timestamptz not null default now()
);
create table if not exists public.ryvo_ops_settings (
 id integer primary key check(id=1), manual_enabled boolean not null default false,
 wholesale_rate integer not null default 0 check(wholesale_rate between 0 and 1000),
 bank_name text not null default '', account_name text not null default '', account_number text not null default ''
);
insert into public.ryvo_ops_settings(id) values(1) on conflict do nothing;
alter table public.ryvo_staff enable row level security;
alter table public.ryvo_merchants enable row level security;
alter table public.ryvo_trade_orders enable row level security;
alter table public.ryvo_stock_requests enable row level security;
alter table public.ryvo_payment_receipts enable row level security;
alter table public.ryvo_audit enable row level security;
alter table public.ryvo_ops_settings enable row level security;
-- No direct client reads/writes. The scoped RPC below is the only API.
revoke all on public.ryvo_staff, public.ryvo_merchants, public.ryvo_trade_orders, public.ryvo_stock_requests,
 public.ryvo_payment_receipts, public.ryvo_audit, public.ryvo_ops_settings from public,anon,authenticated;

create or replace function public.ryvo_merchant_directory()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'name',m.name,'rate',m.rate,'minimum',m.minimum,'maximum',m.maximum,'credits',m.credits) order by m.name),'[]'::jsonb)
 from public.ryvo_merchants m where m.status='approved' and m.online and m.credits>=m.minimum::bigint*m.rate
 and exists(select 1 from public.ryvo_ops_settings where id=1 and manual_enabled)
$$;
revoke all on function public.ryvo_merchant_directory() from public;
grant execute on function public.ryvo_merchant_directory() to anon,authenticated;

create or replace function public.ryvo_operation(action text,payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); administrator boolean; merchant public.ryvo_merchants;
 trade public.ryvo_trade_orders; stock public.ryvo_stock_requests; settings public.ryvo_ops_settings;
 target uuid; amount bigint; quantity bigint; receipt_reference text; desired text; result jsonb;
begin
 if uid is null then raise exception 'Sign in to continue.' using errcode='42501'; end if;
 select exists(select 1 from public.ryvo_staff where user_id=uid and role='admin') into administrator;
 select * into merchant from public.ryvo_merchants where user_id=uid;
 select * into settings from public.ryvo_ops_settings where id=1;
 if action='workspace' then
  return jsonb_build_object('admin',administrator,'merchant',case when merchant.user_id is null then 'null'::jsonb else to_jsonb(merchant) end,
   'merchants',case when administrator then (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from public.ryvo_merchants order by created_at desc limit 500) x) else '[]'::jsonb end,
   'orders',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from public.ryvo_trade_orders where administrator or buyer_id=uid or merchant_id=uid order by created_at desc limit 200) x),
   'stock',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select * from public.ryvo_stock_requests where administrator or merchant_id=uid order by created_at desc limit 200) x),
   'audit',case when administrator then (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select a.id,a.actor,coalesce(u.raw_user_meta_data->>'name','Account') as actor_name,a.action,a.subject,a.created_at from public.ryvo_audit a join auth.users u on u.id=a.actor order by a.id desc limit 200) x) else '[]'::jsonb end,
   'competitions',case when administrator then (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select id,creator_id,published,definition from public.competitions order by created_at desc limit 500) x) else '[]'::jsonb end,
   'players',case when administrator then (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select w.user_id,coalesce(u.raw_user_meta_data->>'name','Player') as name,u.email,w.credits,w.earnings,w.created_at from public.wallets w join auth.users u on u.id=w.user_id order by w.created_at desc limit 500) x) else '[]'::jsonb end,
   'settings',case when administrator or merchant.status='approved' then to_jsonb(settings) else jsonb_build_object('manual_enabled',false,'wholesale_rate',0,'bank_name','','account_name','','account_number','') end);
 elsif action='apply-merchant' then
  if length(trim(coalesce(payload->>'name','')))<2 or length(trim(payload->>'name'))>60
   or length(trim(coalesce(payload->>'bank_name','')))<2 or length(payload->>'bank_name')>80
   or length(trim(coalesce(payload->>'account_name','')))<2 or length(payload->>'account_name')>100
   or coalesce(payload->>'account_number','') !~ '^[0-9]{10}$' then raise exception 'Enter your business name and complete bank details.'; end if;
  if merchant.user_id is not null then raise exception 'Your merchant application is already registered.'; end if;
  insert into public.ryvo_merchants(user_id,name,bank_name,account_name,account_number)
  values(uid,trim(payload->>'name'),trim(payload->>'bank_name'),trim(payload->>'account_name'),payload->>'account_number');
 elsif action='review-merchant' then
  if not administrator then raise exception 'Administrator access required.' using errcode='42501'; end if;
  target:=(payload->>'user_id')::uuid; desired:=payload->>'status';
  if desired not in ('approved','suspended') or desired is null then raise exception 'Choose an approval status.'; end if;
  update public.ryvo_merchants set status=desired,online=case when desired='suspended' then false else online end where user_id=target;
  if not found then raise exception 'Merchant not found.'; end if;
 elsif action='save-offer' then
  if merchant.status is distinct from 'approved' then raise exception 'An approved merchant account is required.' using errcode='42501'; end if;
  update public.ryvo_merchants set rate=(payload->>'rate')::integer,minimum=(payload->>'minimum')::integer,maximum=(payload->>'maximum')::integer,online=coalesce((payload->>'online')::boolean,false) where user_id=uid;
 elsif action='save-settings' then
  if not administrator then raise exception 'Administrator access required.' using errcode='42501'; end if;
  if (payload->>'wholesale_rate')::integer not between 1 and 1000
   or coalesce(payload->>'account_number','') !~ '^[0-9]{10}$'
   or length(trim(coalesce(payload->>'bank_name','')))<2 or length(payload->>'bank_name')>80
   or length(trim(coalesce(payload->>'account_name','')))<2 or length(payload->>'account_name')>100 then raise exception 'Enter a valid wholesale rate and treasury bank details.'; end if;
  update public.ryvo_ops_settings set wholesale_rate=(payload->>'wholesale_rate')::integer,bank_name=trim(payload->>'bank_name'),account_name=trim(payload->>'account_name'),account_number=payload->>'account_number',manual_enabled=coalesce((payload->>'manual_enabled')::boolean,false) where id=1;
 elsif action='request-stock' then
  if merchant.status is distinct from 'approved' then raise exception 'An approved merchant account is required.' using errcode='42501'; end if;
  if not settings.manual_enabled or settings.wholesale_rate<1 then raise exception 'Wholesale purchases are not open yet.'; end if;
  select to_jsonb(s) into result from public.ryvo_stock_requests s where request_id=(payload->>'request_id')::uuid and merchant_id=uid;
  if result is not null then return result; end if;
  quantity:=(payload->>'credits')::bigint;
  if quantity is null or quantity not between 1000 and 10000000 or quantity%settings.wholesale_rate<>0 then raise exception 'Choose 1,000–10,000,000 credits, divisible by the wholesale rate.'; end if;
  if (select count(*) from public.ryvo_stock_requests where merchant_id=uid and status='pending')>=5 then raise exception 'You already have five purchases awaiting review.'; end if;
  insert into public.ryvo_stock_requests(request_id,merchant_id,merchant_name,credits,amount,rate,bank_name,account_name,account_number) values((payload->>'request_id')::uuid,uid,merchant.name,quantity,quantity/settings.wholesale_rate,settings.wholesale_rate,settings.bank_name,settings.account_name,settings.account_number) returning to_jsonb(ryvo_stock_requests.*) into result;
 elsif action='review-stock' then
  if not administrator then raise exception 'Administrator access required.' using errcode='42501'; end if;
  select * into stock from public.ryvo_stock_requests where id=(payload->>'id')::uuid for update;
  if not found then raise exception 'Purchase not found.'; end if;
  if stock.status='completed' then return to_jsonb(stock); end if;
  if stock.status<>'pending' then raise exception 'This purchase has already been reviewed.'; end if;
  if payload->>'decision'='approve' then
   if not settings.manual_enabled or coalesce((payload->>'verified')::boolean,false)=false then raise exception 'Verify the bank transfer before releasing credits.'; end if;
   receipt_reference:=upper(trim(coalesce(payload->>'reference','')));
   if length(receipt_reference) not between 6 and 100 then raise exception 'Enter the unique bank transaction reference.'; end if;
   perform 1 from public.ryvo_merchants where user_id=stock.merchant_id and status='approved' for update;
   if not found then raise exception 'The merchant must be approved before receiving stock.'; end if;
   insert into public.ryvo_payment_receipts(reference,subject,verified_by) values(receipt_reference,stock.id,uid);
   update public.ryvo_merchants set credits=credits+stock.credits where user_id=stock.merchant_id;
   update public.ryvo_stock_requests set status='completed',reference=receipt_reference where id=stock.id;
  elsif payload->>'decision'='reject' then update public.ryvo_stock_requests set status='rejected' where id=stock.id;
  else raise exception 'Choose approve or reject.'; end if;
 elsif action='create-order' then
  if not settings.manual_enabled then raise exception 'Merchant trading is currently paused.'; end if;
  select to_jsonb(t) into result from public.ryvo_trade_orders t where request_id=(payload->>'request_id')::uuid and buyer_id=uid;
  if result is not null then return result; end if;
  target:=(payload->>'merchant_id')::uuid;
  if target=uid then raise exception 'You cannot buy from your own merchant account.'; end if;
  select * into merchant from public.ryvo_merchants where user_id=target for update;
  if not found or merchant.status<>'approved' or not merchant.online then raise exception 'This merchant is not accepting orders.'; end if;
  amount:=(payload->>'amount')::bigint;
  if amount is null or amount<merchant.minimum or amount>merchant.maximum then raise exception 'Choose an amount within the merchant limits.'; end if;
  quantity:=amount*merchant.rate;
  if merchant.credits<quantity then raise exception 'This merchant does not have enough available credit.'; end if;
  if (select count(*) from public.ryvo_trade_orders where buyer_id=uid and status in ('awaiting_payment','payment_reported','disputed'))>=3 then raise exception 'Finish or cancel your existing orders first.'; end if;
  update public.ryvo_merchants set credits=credits-quantity where user_id=target;
  insert into public.ryvo_trade_orders(request_id,buyer_id,merchant_id,merchant_name,buyer_name,amount,credits,bank_name,account_name,account_number)
   values((payload->>'request_id')::uuid,uid,target,merchant.name,(select left(coalesce(raw_user_meta_data->>'name','Player'),50) from auth.users where id=uid),amount,quantity,merchant.bank_name,merchant.account_name,merchant.account_number) returning to_jsonb(ryvo_trade_orders.*) into result;
 elsif action in ('report-payment','complete-order','cancel-order','dispute-order') then
  select * into trade from public.ryvo_trade_orders where id=(payload->>'id')::uuid for update;
  if not found or (not administrator and uid<>trade.buyer_id and uid<>trade.merchant_id) then raise exception 'Order not available.' using errcode='42501'; end if;
  if action='report-payment' then
   if uid<>trade.buyer_id then raise exception 'Only the buyer can report payment.'; end if;
   if trade.status='payment_reported' then return to_jsonb(trade); end if;
   if trade.status<>'awaiting_payment' or trade.expires_at<now() then raise exception 'The payment window has closed. Contact support if you transferred funds.'; end if;
   update public.ryvo_trade_orders set status='payment_reported' where id=trade.id;
  elsif action='complete-order' then
   select * into merchant from public.ryvo_merchants where user_id=trade.merchant_id for update;
   if not administrator and (uid<>trade.merchant_id or merchant.status is distinct from 'approved') then raise exception 'Merchant approval required.' using errcode='42501'; end if;
   if trade.status='completed' then return to_jsonb(trade); end if;
   if trade.status<>'payment_reported' and not (administrator and trade.status='disputed') then raise exception 'Payment must be reported before releasing credit.'; end if;
   if not settings.manual_enabled or coalesce((payload->>'verified')::boolean,false)=false then raise exception 'Verify the actual bank receipt first.'; end if;
   receipt_reference:=upper(trim(coalesce(payload->>'reference','')));
   if length(receipt_reference) not between 6 and 100 then raise exception 'Enter the unique bank transaction reference.'; end if;
   insert into public.ryvo_payment_receipts(reference,subject,verified_by) values(receipt_reference,trade.id,uid);
   update public.wallets set credits=credits+trade.credits where user_id=trade.buyer_id;
   if not found then raise exception 'The buyer wallet is not available.'; end if;
   insert into public.wallet_entries(user_id,label,amount,currency,reference) values(trade.buyer_id,'P2P funding · '||trade.merchant_name,trade.credits,'RYVO','p2p:'||trade.id);
   update public.ryvo_trade_orders set status='completed',payment_reference=receipt_reference where id=trade.id;
  elsif action='cancel-order' then
   if trade.status='cancelled' then return to_jsonb(trade); end if;
   if trade.status<>'awaiting_payment' and not (administrator and trade.status='disputed') then raise exception 'A reported transfer needs administrator review before cancellation.'; end if;
   if trade.status='disputed' and coalesce((payload->>'resolved')::boolean,false)=false then raise exception 'Resolve the dispute and any required bank refund before cancelling.'; end if;
   update public.ryvo_merchants set credits=credits+trade.credits where user_id=trade.merchant_id;
   update public.ryvo_trade_orders set status='cancelled' where id=trade.id;
  else
   if trade.status not in ('awaiting_payment','payment_reported') then raise exception 'This order cannot be escalated.'; end if;
   update public.ryvo_trade_orders set status='disputed' where id=trade.id;
  end if;
 elsif action='moderate-competition' then
  if not administrator then raise exception 'Administrator access required.' using errcode='42501'; end if;
  update public.competitions set published=coalesce((payload->>'published')::boolean,false) where id=payload->>'id';
  if not found then raise exception 'Competition not found.'; end if;
 else raise exception 'Unknown workspace action.';
 end if;
 insert into public.ryvo_audit(actor,action,subject) values(uid,action,coalesce(payload->>'id',payload->>'user_id',payload->>'request_id',uid::text));
 return coalesce(result,jsonb_build_object('ok',true));
exception when unique_violation then raise exception 'This payment reference or request has already been used.';
end;
$$;
revoke all on function public.ryvo_operation(text,jsonb) from public,anon;
grant execute on function public.ryvo_operation(text,jsonb) to authenticated;
commit;
