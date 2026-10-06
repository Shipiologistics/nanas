begin;

insert into public.feature_flags(key,description,enabled,targeting_rules,rollout_percent)
values('qa_payment_simulation','Test-only simulated booking payments for explicitly enrolled QA accounts',false,'{"user_ids":[]}'::jsonb,0)
on conflict(key) do nothing;

create or replace function app_private.payment_simulation_allowed()
returns boolean language sql stable security definer set search_path=''
as $$ select coalesce(exists(select 1 from public.feature_flags where key='qa_payment_simulation' and enabled
  and targeting_rules->'user_ids' ? (select auth.uid())::text),false)
  and app_private.has_role('buyer'); $$;
create or replace function public.payment_simulation_allowed()
returns boolean language sql security invoker set search_path=''
as $$ select app_private.payment_simulation_allowed(); $$;

-- Preserve the transactional ledger implementation but remove its direct
-- authenticated entry point. Only the guarded wrapper below can invoke it.
alter function app_private.accept_quote_with_simulated_payment(uuid,text) rename to accept_quote_simulation_core;
revoke all on function app_private.accept_quote_simulation_core(uuid,text) from public,anon,authenticated;

create function app_private.accept_quote_with_simulated_payment(p_quote_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_quote public.booking_quotes%rowtype;
  v_existing public.bookings%rowtype;
  v_result jsonb;
begin
  if not app_private.payment_simulation_allowed() then raise exception 'test_payment_not_enabled'; end if;
  if char_length(coalesce(p_idempotency_key,'')) not between 8 and 200 then raise exception 'idempotency_key_required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||p_idempotency_key,0));
  select b.* into v_existing from public.payment_intents p join public.bookings b on b.id=p.booking_id
    where p.payer_id=v_user and p.idempotency_key=p_idempotency_key and p.processor='simulation';
  if found then
    if v_existing.quote_id <> p_quote_id then raise exception 'idempotency_key_conflict'; end if;
    return jsonb_build_object('ok',true,'booking_id',v_existing.id,'reference',v_existing.reference,'replayed',true);
  end if;
  select * into v_quote from public.booking_quotes where id=p_quote_id for update;
  if not found or v_quote.buyer_id<>v_user or v_quote.expires_at<=now() or v_quote.starts_at<=now()
  then raise exception 'quote_unavailable'; end if;
  if not exists(select 1 from public.feature_flags where key='qa_payment_simulation' and enabled
    and targeting_rules->'user_ids' ? v_quote.seller_id::text) then raise exception 'test_provider_not_enabled'; end if;
  v_result := app_private.accept_quote_simulation_core(p_quote_id,p_idempotency_key);
  return v_result;
end;
$$;

create or replace function public.accept_quote_with_simulated_payment(p_quote_id uuid,p_idempotency_key text)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.accept_quote_with_simulated_payment(p_quote_id,p_idempotency_key); $$;
revoke all on function app_private.payment_simulation_allowed(),public.payment_simulation_allowed(),
  app_private.accept_quote_with_simulated_payment(uuid,text),public.accept_quote_with_simulated_payment(uuid,text) from public,anon;
grant execute on function app_private.payment_simulation_allowed(),public.payment_simulation_allowed(),
  app_private.accept_quote_with_simulated_payment(uuid,text),public.accept_quote_with_simulated_payment(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
