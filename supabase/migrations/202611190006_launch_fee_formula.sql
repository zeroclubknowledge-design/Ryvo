-- Run in Supabase SQL Editor after 202611190005_usdc_competitions.sql.
-- The launch fee is now set by the game's size (players, winner slots and
-- pieces) instead of the creator's chosen share; creators earn a fixed 10%.
begin;
do $$ begin
 if to_regprocedure('public.ryvo_prepare_competition_payment(uuid,text,text,jsonb,text)') is null then
  raise exception 'Run 202611190005_usdc_competitions.sql in this Supabase project first.';
 end if;
end $$;

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
  fee:=(launch_draft->>'fee')::int; cap:=(launch_draft->>'capacity')::int; win:=(launch_draft->>'winners')::int; share:=10; total:=(launch_draft->>'total')::int;
  art_path:=launch_draft->>'artworkPath'; cover_path:=launch_draft->>'coverPath';
  if length(trim(coalesce(launch_draft->>'title','')))not between 3 and 70
   or length(trim(coalesce(launch_draft->>'description','')))not between 20 and 1200
   or length(trim(coalesce(launch_draft->>'artist','')))not between 2 and 80
   or fee not in (500,1000,2000)
   or total not between 10 and 50 or cap not between 2 and 10000 or win not between 1 and cap
   or art_path !~ ('^'||actor::text||'/[a-f0-9-]{36}\.(jpg|png|webp)$')
   or cover_path !~ ('^'||actor::text||'/[a-f0-9-]{36}\.(jpg|png|webp)$')
  then raise exception 'Check your artwork, title, story, 10–50 pieces, player capacity, winner slots and entry fee.'; end if;
  -- Launch fee in cents, set by the size of the game (same formula as web/lib/launch-fee.ts):
  -- $1.00 base + $0.01 per player + $0.10 per winner slot + $0.0005 per piece in play.
  amount:=ceil(100 + cap*1 + win*10 + cap::numeric*total*0.05)::bigint*10000;
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

revoke all on function public.ryvo_prepare_competition_payment(uuid,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.ryvo_prepare_competition_payment(uuid,text,text,jsonb,text) to service_role;
commit;
