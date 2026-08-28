begin;

create or replace function app_private.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_display_name text;
begin
  v_role := case
    when coalesce(new.raw_user_meta_data ->> 'requested_role', 'buyer') = 'seller' then 'seller'::public.app_role
    else 'buyer'::public.app_role
  end;
  v_display_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if char_length(v_display_name) < 2 then v_display_name := 'Nanas member'; end if;
  v_display_name := left(v_display_name, 80);

  insert into public.profiles(id, display_name, phone_e164)
  values (
    new.id,
    v_display_name,
    case when new.phone ~ '^\\+[1-9][0-9]{7,14}$' then new.phone else null end
  ) on conflict (id) do update
    set display_name = excluded.display_name,
        phone_e164 = coalesce(public.profiles.phone_e164, excluded.phone_e164),
        updated_at = now();

  insert into public.user_roles(user_id, role)
  values (new.id, v_role)
  on conflict (user_id, role) where revoked_at is null do nothing;

  insert into public.user_preferences(user_id)
  values (new.id) on conflict (user_id) do nothing;

  insert into public.notification_preferences(user_id, event_category, in_app, push, email, sms)
  values
    (new.id, 'booking', true, true, true, false),
    (new.id, 'messages', true, true, true, false),
    (new.id, 'payments', true, true, true, false),
    (new.id, 'account', true, true, true, false),
    (new.id, 'safety', true, true, true, true)
  on conflict (user_id, event_category) do nothing;

  insert into public.ledger_accounts(account_type, owner_user_id, currency)
  values (
    case when v_role = 'seller' then 'seller_wallet' else 'buyer_wallet' end,
    new.id,
    'BSD'
  ) on conflict do nothing;

  if v_role = 'buyer' then
    insert into public.households(owner_user_id, name)
    select new.id, 'My household'
    where not exists (select 1 from public.households where owner_user_id = new.id);
  else
    insert into public.seller_profiles(user_id, display_name, status)
    values (new.id, v_display_name, 'draft')
    on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now();
  end if;

  insert into public.domain_events(aggregate_type, aggregate_id, event_type, payload_redacted)
  values ('user', new.id, 'user.bootstrapped', jsonb_build_object('role', v_role));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function app_private.handle_auth_user_created();

revoke all on function app_private.handle_auth_user_created() from public, anon, authenticated;

commit;
