begin;

create or replace function app_private.preview_booking_cancellation(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_actor text;
  v_hours numeric;
  v_fee_percent numeric := 0;
  v_fee bigint;
  v_refund bigint;
  v_payment public.payment_intents%rowtype;
  v_protected_balance bigint;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'booking_not_found'; end if;
  if v_user not in (v_booking.buyer_id, v_booking.seller_id)
    and not app_private.has_admin_permission('bookings.manage') then
    raise exception 'booking_access_denied';
  end if;
  if v_booking.status <> 'confirmed' then raise exception 'booking_not_cancellable'; end if;
  select * into v_payment from public.payment_intents where booking_id=p_booking_id
    and status in ('captured','partially_refunded') order by created_at desc limit 1;
  if not found then raise exception 'captured_funds_unavailable'; end if;
  if v_payment.processor<>'simulation' then raise exception 'refund_processor_not_connected'; end if;
  if v_payment.currency<>v_booking.currency or v_payment.captured_minor<>v_booking.total_minor
    or v_payment.refunded_minor<>0 then raise exception 'payment_booking_mismatch'; end if;
  select coalesce(sum(case when e.direction='credit' then e.amount_minor else -e.amount_minor end),0)
    into v_protected_balance from public.ledger_entries e join public.ledger_accounts a on a.id=e.account_id
    where e.booking_id=p_booking_id and a.account_type='protected_funds' and a.currency=v_booking.currency;
  if v_protected_balance<>v_booking.total_minor then raise exception 'protected_funds_unavailable'; end if;

  v_actor := case
    when v_user = v_booking.buyer_id then 'buyer'
    when v_user = v_booking.seller_id then 'seller'
    else 'admin'
  end;
  v_hours := extract(epoch from (v_booking.scheduled_start - now())) / 3600.0;

  -- The standard-v1 rules are copied into the immutable cancellation decision.
  -- Seller/admin cancellations and buyer cancellations 24h+ before care are free;
  -- buyer cancellations 6-24h before care charge 10%, and under 6h charge 25%.
  if v_actor = 'buyer' then
    v_fee_percent := case when v_hours >= 24 then 0 when v_hours >= 6 then 10 else 25 end;
  end if;
  v_fee := least(v_booking.total_minor, round(v_booking.total_minor * v_fee_percent / 100.0)::bigint);
  v_refund := greatest(v_booking.total_minor - v_fee, 0);

  return jsonb_build_object(
    'ok', true,
    'booking_id', v_booking.id,
    'currency', v_booking.currency,
    'captured_minor', v_booking.total_minor,
    'fee_minor', v_fee,
    'refund_minor', v_refund,
    'policy', jsonb_build_object(
      'name', 'standard', 'version', 1, 'actor', v_actor,
      'hours_before_start', round(v_hours, 2), 'fee_percent', v_fee_percent,
      'source_snapshot', v_booking.cancellation_policy_snapshot
    )
  );
end;
$$;

create or replace function public.preview_booking_cancellation(p_booking_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.preview_booking_cancellation(p_booking_id); $$;

create or replace function app_private.cancel_booking(
  p_booking_id uuid,
  p_reason_code text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_payment public.payment_intents%rowtype;
  v_preview jsonb;
  v_fee bigint;
  v_refund bigint;
  v_tx_id uuid := gen_random_uuid();
  v_protected uuid;
  v_buyer_wallet uuid;
  v_platform uuid;
  v_existing public.cancellations%rowtype;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if char_length(coalesce(p_idempotency_key,'')) not between 8 and 200 then raise exception 'idempotency_key_required'; end if;
  if char_length(trim(coalesce(p_reason_code, ''))) < 3 or char_length(p_reason_code) > 80 then raise exception 'invalid_reason_code'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  -- Authorization must precede the replay response, not only the first write.
  if v_user not in (v_booking.buyer_id,v_booking.seller_id)
    and not app_private.has_admin_permission('bookings.manage') then raise exception 'booking_access_denied'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cancel:'||v_user::text||':'||p_idempotency_key,0));
  if exists(select 1 from public.booking_status_history where actor_id=v_user and idempotency_key=p_idempotency_key
    and (booking_id<>p_booking_id or to_status<>'cancelled')) then raise exception 'idempotency_key_conflict'; end if;

  select * into v_existing from public.cancellations where booking_id = p_booking_id;
  if found then
    return jsonb_build_object(
      'ok', true, 'booking_id', p_booking_id, 'status', 'cancelled', 'replayed', true,
      'currency',v_booking.currency,'fee_minor', v_existing.fee_minor, 'refund_minor', v_existing.refund_minor
    );
  end if;

  v_preview := app_private.preview_booking_cancellation(p_booking_id);
  v_fee := (v_preview ->> 'fee_minor')::bigint;
  v_refund := (v_preview ->> 'refund_minor')::bigint;

  select * into v_payment
  from public.payment_intents
  where booking_id = p_booking_id and status in ('captured', 'partially_refunded')
  order by created_at desc limit 1 for update;
  if not found or v_payment.processor<>'simulation' or v_payment.currency<>v_booking.currency
    or v_payment.captured_minor<>v_booking.total_minor or v_payment.refunded_minor<>0 then
    raise exception 'captured_funds_unavailable';
  end if;

  insert into public.ledger_accounts(account_type, owner_user_id, currency)
  values ('buyer_wallet', v_booking.buyer_id, v_booking.currency),
         ('protected_funds', null, v_booking.currency),
         ('platform_revenue', null, v_booking.currency)
  on conflict do nothing;
  select id into v_buyer_wallet from public.ledger_accounts
    where account_type = 'buyer_wallet' and owner_user_id = v_booking.buyer_id and currency = v_booking.currency;
  select id into v_protected from public.ledger_accounts
    where account_type = 'protected_funds' and owner_user_id is null and currency = v_booking.currency;
  select id into v_platform from public.ledger_accounts
    where account_type = 'platform_revenue' and owner_user_id is null and currency = v_booking.currency;

  insert into public.ledger_transactions(
    id, reference_type, reference_id, event_type, currency, description, idempotency_key
  ) values (
    v_tx_id, 'booking', p_booking_id, 'booking_cancelled', v_booking.currency,
    'Simulated cancellation refund and fee allocation', 'cancel:' || v_user::text || ':' || p_booking_id::text || ':' || p_idempotency_key
  );
  insert into public.ledger_entries(transaction_id, account_id, direction, amount_minor, booking_id, buyer_id, seller_id)
  values (v_tx_id, v_protected, 'debit', v_booking.total_minor, p_booking_id, v_booking.buyer_id, v_booking.seller_id);
  if v_refund > 0 then
    insert into public.ledger_entries(transaction_id, account_id, direction, amount_minor, booking_id, buyer_id, seller_id)
    values (v_tx_id, v_buyer_wallet, 'credit', v_refund, p_booking_id, v_booking.buyer_id, v_booking.seller_id);
    insert into public.refunds(
      booking_id, payment_intent_id, amount_minor, currency, reason, status,
      requested_by, approved_by, processed_at
    ) values (
      p_booking_id, v_payment.id, v_refund, v_booking.currency, left(p_reason_code, 80),
      'refunded', v_user, v_user, now()
    );
  end if;
  if v_fee > 0 then
    insert into public.ledger_entries(transaction_id, account_id, direction, amount_minor, booking_id, buyer_id, seller_id)
    values (v_tx_id, v_platform, 'credit', v_fee, p_booking_id, v_booking.buyer_id, v_booking.seller_id);
  end if;

  update public.payment_intents
  set refunded_minor = refunded_minor + v_refund,
      status = case when refunded_minor + v_refund = captured_minor then 'refunded'::public.payment_status else 'partially_refunded'::public.payment_status end,
      updated_at = now()
  where id = v_payment.id;
  update public.bookings
  set status = 'cancelled', blocks_calendar = false, cancelled_at = now(), version = version + 1
  where id = p_booking_id;
  insert into public.cancellations(booking_id, actor_id, reason_code, policy_snapshot, fee_minor, refund_minor)
  values (p_booking_id, v_user, left(p_reason_code, 80), v_preview -> 'policy', v_fee, v_refund);
  insert into public.booking_status_history(booking_id, from_status, to_status, actor_id, reason_code, idempotency_key)
  values (p_booking_id, v_booking.status, 'cancelled', v_user, left(p_reason_code, 80), p_idempotency_key);
  insert into public.domain_events(aggregate_type, aggregate_id, event_type, payload_redacted)
  values ('booking', p_booking_id, 'booking.cancelled', jsonb_build_object('actor_id', v_user, 'fee_minor', v_fee, 'refund_minor', v_refund));
  insert into public.notification_outbox(recipient_id, template_key, category, priority, variables_redacted, dedupe_key)
  select party_id, 'booking_cancelled', 'booking', 'high',
    jsonb_build_object('booking_id', p_booking_id, 'refund_minor', v_refund, 'fee_minor', v_fee),
    'booking_cancelled:' || p_booking_id::text || ':' || party_id::text
  from (values (v_booking.buyer_id), (v_booking.seller_id)) parties(party_id);

  return jsonb_build_object(
    'ok', true, 'booking_id', p_booking_id, 'status', 'cancelled',
    'currency', v_booking.currency, 'fee_minor', v_fee, 'refund_minor', v_refund,
    'ledger_transaction_id', v_tx_id
  );
end;
$$;

create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_reason_code text,
  p_idempotency_key text
)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.cancel_booking(p_booking_id, p_reason_code, p_idempotency_key); $$;

-- The old three-argument entry point is retained only for migration compatibility,
-- but cannot be called by clients. The preview-aware overload is the client API.
create or replace function public.cancel_booking(
  p_booking_id uuid,p_reason_code text,p_idempotency_key text,p_expected_fee_minor bigint
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_status public.booking_status; v_preview jsonb;
begin
  if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
  select status into v_status from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  if v_status<>'cancelled' then
    v_preview:=app_private.preview_booking_cancellation(p_booking_id);
    if p_expected_fee_minor is distinct from (v_preview->>'fee_minor')::bigint then
      raise exception 'cancellation_preview_changed';
    end if;
  end if;
  return app_private.cancel_booking(p_booking_id,p_reason_code,p_idempotency_key);
end;
$$;
revoke all on function public.cancel_booking(uuid,text,text),
  app_private.cancel_booking(uuid,text,text) from public,anon,authenticated;
revoke all on function public.preview_booking_cancellation(uuid),
  app_private.preview_booking_cancellation(uuid),public.cancel_booking(uuid,text,text,bigint) from public,anon;
grant execute on function public.preview_booking_cancellation(uuid),
  app_private.preview_booking_cancellation(uuid),public.cancel_booking(uuid,text,text,bigint) to authenticated;
notify pgrst,'reload schema';
commit;

