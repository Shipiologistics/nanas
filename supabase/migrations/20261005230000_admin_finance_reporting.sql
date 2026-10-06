begin;

-- Finance-read admins already read accounts and entries. Permit the linked
-- immutable transaction headers; ordinary participants gain no new visibility.
create policy ledger_transactions_finance_admin on public.ledger_transactions
for select to authenticated using (app_private.has_admin_permission('finance.read'));

create or replace function public.admin_finance_summary()
returns jsonb language plpgsql stable security invoker set search_path=''
as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not app_private.has_admin_permission('finance.read') then
    raise exception 'permission_denied';
  end if;
  with payments as (
    select currency,
      count(*) as payment_count,
      coalesce(sum(captured_minor),0) as captured_minor,
      coalesce(sum(refunded_minor),0) as refunded_minor,
      coalesce(sum(captured_minor) filter(where processor='simulation'),0) as simulated_captured_minor,
      coalesce(sum(captured_minor) filter(where processor<>'simulation'),0) as external_captured_minor
    from public.payment_intents group by currency
  ), balances as (
    select currency,
      coalesce(sum(balance_minor) filter(where account_type='seller_wallet'),0) as provider_wallet_minor,
      coalesce(sum(balance_minor) filter(where account_type='buyer_wallet'),0) as buyer_wallet_minor,
      coalesce(sum(balance_minor) filter(where account_type='protected_funds'),0) as protected_minor,
      coalesce(sum(balance_minor) filter(where account_type='platform_revenue'),0) as platform_minor,
      coalesce(sum(balance_minor) filter(where account_type='seller_wallet' and status='held'),0) as held_provider_wallet_minor,
      coalesce(sum(balance_minor),0) as ledger_imbalance_minor
    from public.wallet_balances group by currency
  ), currencies as (select currency from payments union select currency from balances)
  select jsonb_build_object('as_of',statement_timestamp(),'currencies',coalesce(jsonb_agg(jsonb_build_object(
    'currency',trim(c.currency),
    'payment_count',coalesce(p.payment_count,0),
    'captured_minor',coalesce(p.captured_minor,0),
    'refunded_minor',coalesce(p.refunded_minor,0),
    'simulated_captured_minor',coalesce(p.simulated_captured_minor,0),
    'external_captured_minor',coalesce(p.external_captured_minor,0),
    'provider_wallet_minor',coalesce(b.provider_wallet_minor,0),
    'buyer_wallet_minor',coalesce(b.buyer_wallet_minor,0),
    'protected_minor',coalesce(b.protected_minor,0),
    'platform_minor',coalesce(b.platform_minor,0),
    'held_provider_wallet_minor',coalesce(b.held_provider_wallet_minor,0),
    'ledger_imbalance_minor',coalesce(b.ledger_imbalance_minor,0)
  ) order by c.currency),'[]'::jsonb)) into result
  from currencies c left join payments p using(currency) left join balances b using(currency);
  return result;
end;
$$;
revoke all on function public.admin_finance_summary() from public,anon;
grant execute on function public.admin_finance_summary() to authenticated;

-- Preserve this legacy column for existing clients, but define it correctly:
-- gross BSD simulated captures, including captures later refunded.
create or replace view public.admin_overview with(security_invoker=true) as
select
  (select count(*) from public.profiles where account_status='active') active_users,
  (select count(*) from public.seller_profiles where status='under_review') sellers_under_review,
  (select count(*) from public.booking_requests where status in('requested','offered')) open_care_requests,
  (select count(*) from public.bookings where status in('confirmed','in_progress','completion_pending')) active_bookings,
  (select count(*) from public.service_disputes where status not in('resolved','closed')) open_disputes,
  (select count(*) from public.moderation_reports where status not in('resolved','closed')) moderation_queue,
  (select coalesce(sum(captured_minor),0) from public.payment_intents where processor='simulation' and currency='BSD') simulated_volume_minor;
grant select on public.admin_overview to authenticated;
notify pgrst, 'reload schema';
commit;
