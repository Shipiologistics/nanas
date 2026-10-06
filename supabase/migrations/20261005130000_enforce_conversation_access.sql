begin;

-- A durable per-conversation entitlement, never a browser-local unlock flag.
create table public.conversation_access_purchases (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id),
  buyer_id uuid not null references public.profiles(id),
  payment_intent_id uuid not null unique references public.payment_intents(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'BSD',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (conversation_id,buyer_id),
  unique (buyer_id,idempotency_key)
);
alter table public.conversation_access_purchases enable row level security;
revoke all on public.conversation_access_purchases from anon,authenticated;
grant select on public.conversation_access_purchases to authenticated;
create policy conversation_purchases_owner on public.conversation_access_purchases for select to authenticated
  using (buyer_id=(select auth.uid()));

create function app_private.conversation_is_locked(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.conversation_members cm
  where cm.conversation_id=p_conversation_id and cm.user_id=(select auth.uid()) and cm.role='buyer' and cm.left_at is null)
  and exists(select 1 from public.messages m join public.conversation_members cm
    on cm.conversation_id=m.conversation_id and cm.user_id=m.sender_id
    where m.conversation_id=p_conversation_id and cm.role='seller' and m.deleted_at is null)
  and not exists(select 1 from public.conversation_access_purchases p
    where p.conversation_id=p_conversation_id and p.buyer_id=(select auth.uid())); $$;

create function app_private.conversation_can_send(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select app_private.is_conversation_member(p_conversation_id)
  and not app_private.conversation_is_locked(p_conversation_id)
  and exists(select 1 from public.conversations where id=p_conversation_id and status='active')
  and not exists(select 1 from public.conversation_members cm join public.blocks b
    on (b.blocker_user_id=(select auth.uid()) and b.blocked_user_id=cm.user_id)
    or (b.blocked_user_id=(select auth.uid()) and b.blocker_user_id=cm.user_id)
    where cm.conversation_id=p_conversation_id and cm.left_at is null); $$;

drop policy messages_members_only on public.messages;
create policy messages_members_only on public.messages for select to authenticated
  using (app_private.is_conversation_member(conversation_id)
    and (sender_id=(select auth.uid()) or not app_private.conversation_is_locked(conversation_id)));
drop policy messages_member_insert on public.messages;
create policy messages_member_insert on public.messages for insert to authenticated
  with check (sender_id=(select auth.uid()) and message_type='text' and char_length(trim(body))>0
    and app_private.conversation_can_send(conversation_id));

-- Metadata is available without returning locked message bodies. Read timestamps
-- use database time and cannot be forged by a direct table update.
revoke update (last_read_at) on public.conversation_members from authenticated;
create function app_private.conversation_access_state()
returns jsonb language sql stable security definer set search_path=''
as $$ select coalesce(jsonb_agg(jsonb_build_object(
  'conversation_id',cm.conversation_id,'locked',app_private.conversation_is_locked(cm.conversation_id),
  'can_send',app_private.conversation_can_send(cm.conversation_id),'last_read_at',cm.last_read_at,
  'unread_count',(select count(*) from public.messages m where m.conversation_id=cm.conversation_id
    and m.sender_id<>cm.user_id and m.deleted_at is null and (cm.last_read_at is null or m.created_at>cm.last_read_at)),
  'other_last_read_at',(select max(other.last_read_at) from public.conversation_members other
    where other.conversation_id=cm.conversation_id and other.user_id<>cm.user_id and other.left_at is null)
  )), '[]'::jsonb)
  from public.conversation_members cm where cm.user_id=(select auth.uid()) and cm.left_at is null; $$;
create function public.conversation_access_state()
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.conversation_access_state(); $$;

create function app_private.mark_conversation_read(p_conversation_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
  if not app_private.is_conversation_member(p_conversation_id) then raise exception 'conversation_unavailable'; end if;
  if app_private.conversation_is_locked(p_conversation_id) then raise exception 'conversation_locked'; end if;
  update public.conversation_members set last_read_at=now()
    where conversation_id=p_conversation_id and user_id=(select auth.uid()) and left_at is null;
  return jsonb_build_object('ok',true);
end; $$;
create function public.mark_conversation_read(p_conversation_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.mark_conversation_read(p_conversation_id); $$;

create function app_private.simulate_conversation_purchase(p_conversation_id uuid,p_expected_amount_minor bigint,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare
  v_user uuid := (select auth.uid()); v_existing public.conversation_access_purchases%rowtype;
  v_amount bigint; v_currency char(3); v_id uuid:=gen_random_uuid(); v_payment uuid:=gen_random_uuid();
  v_tx uuid:=gen_random_uuid(); v_debit uuid; v_credit uuid;
begin
  if not app_private.payment_simulation_allowed() then raise exception 'test_payment_not_enabled'; end if;
  if char_length(coalesce(p_idempotency_key,'')) not between 8 and 200 then raise exception 'idempotency_key_required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||p_idempotency_key,0));
  select * into v_existing from public.conversation_access_purchases where buyer_id=v_user and idempotency_key=p_idempotency_key;
  if found and v_existing.conversation_id<>p_conversation_id then raise exception 'idempotency_key_conflict'; end if;
  perform 1 from public.conversations where id=p_conversation_id for update;
  if not found or not app_private.is_conversation_member(p_conversation_id) or not exists(
    select 1 from public.conversation_members where conversation_id=p_conversation_id and user_id=v_user and role='buyer' and left_at is null)
    then raise exception 'conversation_unavailable'; end if;
  if exists(select 1 from public.conversation_members cm where cm.conversation_id=p_conversation_id and cm.role='seller'
    and not exists(select 1 from public.feature_flags f where f.key='qa_payment_simulation' and f.enabled
      and f.targeting_rules->'user_ids' ? cm.user_id::text)) then raise exception 'test_provider_not_enabled'; end if;
  select * into v_existing from public.conversation_access_purchases where buyer_id=v_user and conversation_id=p_conversation_id;
  if found then return jsonb_build_object('ok',true,'purchase_id',v_existing.id,'replayed',true); end if;
  if not app_private.conversation_is_locked(p_conversation_id) then raise exception 'conversation_not_locked'; end if;
  select fee_minor,currency into v_amount,v_currency from public.job_posting_plans where code='premium' and active;
  if v_amount is null or v_amount<=0 then raise exception 'messaging_price_unavailable'; end if;
  if p_expected_amount_minor is distinct from v_amount then raise exception 'price_changed'; end if;
  insert into public.payment_intents(id,payer_id,processor,external_ref,amount_minor,currency,status,idempotency_key,captured_minor,authorized_at,captured_at)
    values(v_payment,v_user,'simulation','sim_message_'||v_id::text,v_amount,v_currency,'captured','message:'||p_idempotency_key,v_amount,now(),now());
  insert into public.conversation_access_purchases(id,conversation_id,buyer_id,payment_intent_id,amount_minor,currency,idempotency_key)
    values(v_id,p_conversation_id,v_user,v_payment,v_amount,v_currency,p_idempotency_key);
  insert into public.ledger_accounts(account_type,owner_user_id,currency) values('buyer_wallet',v_user,v_currency),('platform_revenue',null,v_currency) on conflict do nothing;
  select id into v_debit from public.ledger_accounts where account_type='buyer_wallet' and owner_user_id=v_user and currency=v_currency;
  select id into v_credit from public.ledger_accounts where account_type='platform_revenue' and owner_user_id is null and currency=v_currency;
  insert into public.ledger_transactions(id,reference_type,reference_id,event_type,currency,description,idempotency_key)
    values(v_tx,'conversation_access',v_id,'payment_captured',v_currency,'TEST ONLY: simulated conversation access','message-capture:'||v_id::text);
  insert into public.ledger_entries(transaction_id,account_id,direction,amount_minor,buyer_id)
    values(v_tx,v_debit,'debit',v_amount,v_user),(v_tx,v_credit,'credit',v_amount,v_user);
  return jsonb_build_object('ok',true,'purchase_id',v_id,'amount_minor',v_amount,'simulation',true);
end; $$;
create function public.simulate_conversation_purchase(p_conversation_id uuid,p_expected_amount_minor bigint,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.simulate_conversation_purchase(p_conversation_id,p_expected_amount_minor,p_idempotency_key); $$;

revoke all on function app_private.conversation_is_locked(uuid),app_private.conversation_can_send(uuid),
  app_private.conversation_access_state(),public.conversation_access_state(),
  app_private.mark_conversation_read(uuid),public.mark_conversation_read(uuid),
  app_private.simulate_conversation_purchase(uuid,bigint,text),public.simulate_conversation_purchase(uuid,bigint,text) from public,anon;
grant execute on function app_private.conversation_is_locked(uuid),app_private.conversation_can_send(uuid),
  app_private.conversation_access_state(),public.conversation_access_state(),
  app_private.mark_conversation_read(uuid),public.mark_conversation_read(uuid),
  app_private.simulate_conversation_purchase(uuid,bigint,text),public.simulate_conversation_purchase(uuid,bigint,text) to authenticated;
notify pgrst,'reload schema';
commit;
