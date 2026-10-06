begin;

-- Role membership deliberately permits restricted users to retain history,
-- support and settlement access. It must not authorize new commitments.
create function app_private.require_active_marketplace_accounts(p_users uuid[])
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid; v_profile public.profiles%rowtype;
begin
  if p_users is null or cardinality(p_users)=0 or array_position(p_users,null) is not null then
    raise exception 'marketplace_account_unavailable';
  end if;
  -- SHARE conflicts with account-status updates (KEY SHARE would not). Hold
  -- these locks until the whole purchase/quote/request transaction completes.
  for v_user in select distinct u from unnest(p_users) as users(u) order by u loop
    select * into v_profile from public.profiles where id=v_user for share;
    if not found or v_profile.account_status<>'active' or v_profile.account_status is null or v_profile.deleted_at is not null then
      if v_user=(select auth.uid()) then raise exception 'account_new_activity_restricted'; end if;
      raise exception 'marketplace_account_unavailable';
    end if;
  end loop;
end; $$;
revoke all on function app_private.require_active_marketplace_accounts(uuid[]) from public,anon,authenticated;

create function app_private.guard_new_marketplace_activity()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_users uuid[];
begin
  if tg_table_name='booking_requests' then
    if tg_op='UPDATE' and new.buyer_id is not distinct from old.buyer_id then return new; end if;
    v_users := array[new.buyer_id];
  elsif tg_table_name in ('booking_quotes','bookings') then
    if tg_op='UPDATE' and new.buyer_id is not distinct from old.buyer_id and new.seller_id is not distinct from old.seller_id then return new; end if;
    v_users := array[new.buyer_id,new.seller_id];
  elsif tg_table_name='payment_intents' then
    if tg_op='UPDATE' and new.payer_id is not distinct from old.payer_id then return new; end if;
    v_users := array[new.payer_id];
  elsif tg_table_name='conversation_access_purchases' then
    if tg_op='UPDATE' and new.buyer_id is not distinct from old.buyer_id and new.conversation_id is not distinct from old.conversation_id then return new; end if;
    select array_agg(u) into v_users from (
      select new.buyer_id as u
      union select cm.user_id from public.conversation_members cm
        where cm.conversation_id=new.conversation_id and cm.left_at is null
    ) participants;
  else
    raise exception 'invalid_marketplace_guard_target';
  end if;
  perform app_private.require_active_marketplace_accounts(v_users);
  return new;
end; $$;
revoke all on function app_private.guard_new_marketplace_activity() from public,anon,authenticated;

-- Guard the write boundary, including SECURITY DEFINER RPCs and server callers.
-- No blanket UPDATE guard: cancellation/refund/completion of an existing
-- obligation must remain possible after an account is restricted.
create trigger booking_requests_active_accounts before insert or update of buyer_id
on public.booking_requests for each row execute function app_private.guard_new_marketplace_activity();
create trigger booking_quotes_active_accounts before insert or update of buyer_id,seller_id
on public.booking_quotes for each row execute function app_private.guard_new_marketplace_activity();
create trigger bookings_active_accounts before insert or update of buyer_id,seller_id
on public.bookings for each row execute function app_private.guard_new_marketplace_activity();
create trigger payment_intents_active_accounts before insert or update of payer_id
on public.payment_intents for each row execute function app_private.guard_new_marketplace_activity();
-- The payment row identifies only its payer. Recheck the conversation parties
-- before selling access; a failure also rolls back the preceding payment row.
create trigger conversation_purchases_active_accounts before insert or update of buyer_id,conversation_id
on public.conversation_access_purchases for each row execute function app_private.guard_new_marketplace_activity();

notify pgrst,'reload schema';
commit;
