begin;

create or replace function app_private.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = (select auth.uid())
      and ur.role = p_role
      and ur.revoked_at is null
      and p.account_status in ('active','restricted')
      and p.deleted_at is null
  );
$$;

create or replace function app_private.has_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.has_role('admin'::public.app_role)
    and exists (
      select 1 from public.admin_permissions ap
      where ap.admin_user_id = (select auth.uid())
        and ap.revoked_at is null
        and (ap.permission_key = p_permission or ap.permission_key = '*')
    );
$$;

create or replace function app_private.is_booking_party(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking_id
      and ((select auth.uid()) = b.buyer_id or (select auth.uid()) = b.seller_id)
  );
$$;

create or replace function app_private.is_request_party(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.booking_requests r
    where r.id = p_request_id and r.buyer_id = (select auth.uid())
  ) or exists (
    select 1 from public.booking_quotes q
    where q.request_id = p_request_id and q.seller_id = (select auth.uid())
  );
$$;

create or replace function app_private.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = (select auth.uid())
      and cm.left_at is null
  );
$$;

create or replace function app_private.safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
begin
  v_display_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, 'Nanas member'), '@', 1));
  insert into public.profiles (id, display_name)
  values (new.id, left(v_display_name, 80))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'buyer')
  on conflict do nothing;

  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.notification_preferences (user_id, event_category)
  values (new.id, 'booking'), (new.id, 'messages'), (new.id, 'account'), (new.id, 'payments')
  on conflict do nothing;
  insert into public.ledger_accounts (account_type, owner_user_id, currency)
  values ('buyer_wallet', new.id, 'BSD') on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function app_private.handle_new_auth_user();

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles','user_preferences','notification_preferences','households','household_members','islands','service_areas','addresses','emergency_contacts',
    'service_categories','services','seller_profiles','seller_services','seller_service_areas','availability_rules','availability_exceptions','seller_documents',
    'verification_cases','seller_credentials','booking_requests','booking_request_private','booking_offers','conversations','payment_methods','payment_intents',
    'ledger_accounts','refunds','payouts','reviews','badges','service_disputes','moderation_reports','notification_outbox','notification_deliveries','feature_flags','system_settings'
  ] loop
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function app_private.set_updated_at()', v_table, v_table);
  end loop;
end $$;

create or replace function app_private.prevent_app_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'append-only record';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger ledger_transactions_immutable before update or delete on public.ledger_transactions for each row execute function app_private.prevent_app_mutation();
create trigger ledger_entries_immutable before update or delete on public.ledger_entries for each row execute function app_private.prevent_app_mutation();
create trigger booking_history_immutable before update or delete on public.booking_status_history for each row execute function app_private.prevent_app_mutation();
create trigger admin_audit_immutable before update or delete on public.admin_audit_logs for each row execute function app_private.prevent_app_mutation();
create trigger admin_access_immutable before update or delete on public.admin_access_logs for each row execute function app_private.prevent_app_mutation();
create trigger domain_events_immutable before update or delete on public.domain_events for each row execute function app_private.prevent_app_mutation();

create or replace function app_private.activate_seller_profile(p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if not app_private.has_role('buyer') then raise exception 'account_not_active'; end if;

  insert into public.user_roles (user_id, role) values (v_user, 'seller') on conflict do nothing;
  insert into public.seller_profiles (user_id, display_name, public_slug)
  values (v_user, left(trim(p_display_name), 80), lower(regexp_replace(trim(p_display_name), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(v_user::text, 1, 8))
  on conflict (user_id) do update set display_name = excluded.display_name;
  insert into public.ledger_accounts (account_type, owner_user_id, currency)
  values ('seller_wallet', v_user, 'BSD') on conflict do nothing;
  return jsonb_build_object('ok', true, 'seller_id', v_user, 'status', 'draft');
end;
$$;

create or replace function public.activate_seller_profile(p_display_name text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select app_private.activate_seller_profile(p_display_name); $$;

create or replace function app_private.submit_seller_quote(
  p_request_id uuid,
  p_rate_minor bigint,
  p_travel_minor bigint,
  p_message text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_request public.booking_requests%rowtype;
  v_service public.seller_services%rowtype;
  v_duration_hours numeric;
  v_base bigint;
  v_fee bigint;
  v_quote_id uuid;
  v_hash text;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_rate_minor < 0 or p_travel_minor < 0 then raise exception 'invalid_amount'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '7 days' then raise exception 'invalid_expiry'; end if;

  select * into v_request from public.booking_requests where id = p_request_id for update;
  if not found or v_request.status not in ('requested','offered') or coalesce(v_request.expires_at, now() + interval '1 day') <= now() then
    raise exception 'request_unavailable';
  end if;
  select ss.* into v_service
  from public.seller_services ss
  join public.seller_profiles sp on sp.user_id = ss.seller_id
  where ss.seller_id = v_user and ss.service_id = v_request.service_id and ss.active and sp.status = 'approved' and sp.profile_published_at is not null;
  if not found then raise exception 'seller_not_eligible'; end if;

  v_duration_hours := extract(epoch from (v_request.desired_end - v_request.desired_start)) / 3600.0;
  v_base := ceil(v_duration_hours * p_rate_minor)::bigint;
  v_fee := ceil((v_base + p_travel_minor) * 0.08)::bigint;
  v_quote_id := gen_random_uuid();
  v_hash := encode(extensions.digest(concat_ws('|', v_quote_id::text, v_user::text, v_request.id::text, v_base::text, p_travel_minor::text, v_fee::text, p_expires_at::text), 'sha256'), 'hex');

  insert into public.booking_quotes (id, request_id, buyer_id, seller_id, service_id, starts_at, ends_at, base_minor, travel_minor, platform_fee_minor, currency, policy_snapshot, quote_hash, expires_at)
  values (v_quote_id, v_request.id, v_request.buyer_id, v_user, v_request.service_id, v_request.desired_start, v_request.desired_end, v_base, p_travel_minor, v_fee, v_request.currency, jsonb_build_object('cancellation','standard','seller_message',left(coalesce(p_message,''),1200),'rate_minor',p_rate_minor), v_hash, p_expires_at);
  update public.booking_requests set status = 'offered' where id = v_request.id;
  insert into public.domain_events (aggregate_type, aggregate_id, event_type, payload_redacted)
  values ('booking_request', v_request.id, 'quote.submitted', jsonb_build_object('quote_id',v_quote_id,'seller_id',v_user));
  insert into public.notification_outbox (recipient_id, template_key, category, priority, variables_redacted, dedupe_key)
  values (v_request.buyer_id, 'quote_received', 'booking', 'normal', jsonb_build_object('request_id',v_request.id,'quote_id',v_quote_id), 'quote_received:' || v_quote_id::text);
  return jsonb_build_object('ok', true, 'quote_id', v_quote_id, 'total_minor', v_base + p_travel_minor + v_fee, 'currency', v_request.currency);
end;
$$;

create or replace function public.submit_seller_quote(p_request_id uuid, p_rate_minor bigint, p_travel_minor bigint default 0, p_message text default null, p_expires_at timestamptz default (now() + interval '48 hours'))
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.submit_seller_quote(p_request_id,p_rate_minor,p_travel_minor,p_message,p_expires_at); $$;

create or replace function app_private.accept_quote_with_simulated_payment(p_quote_id uuid, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_quote public.booking_quotes%rowtype;
  v_request public.booking_requests%rowtype;
  v_booking_id uuid := gen_random_uuid();
  v_payment_id uuid := gen_random_uuid();
  v_conversation_id uuid := gen_random_uuid();
  v_tx_id uuid := gen_random_uuid();
  v_buyer_account uuid;
  v_protected_account uuid;
  v_seller_net bigint;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then raise exception 'idempotency_key_required'; end if;
  select * into v_quote from public.booking_quotes where id = p_quote_id for update;
  if not found or v_quote.buyer_id <> v_user or v_quote.expires_at <= now() then raise exception 'quote_unavailable'; end if;
  select * into v_request from public.booking_requests where id = v_quote.request_id for update;
  if not found or v_request.status not in ('requested','offered') then raise exception 'request_unavailable'; end if;
  if exists (select 1 from public.payment_intents where payer_id=v_user and idempotency_key=p_idempotency_key) then
    select booking_id into v_booking_id from public.payment_intents where payer_id=v_user and idempotency_key=p_idempotency_key;
    return jsonb_build_object('ok',true,'booking_id',v_booking_id,'replayed',true);
  end if;

  v_seller_net := greatest(v_quote.total_minor - v_quote.platform_fee_minor, 0);
  insert into public.bookings (id,buyer_id,seller_id,request_id,quote_id,service_id,address_id,household_member_id,scheduled_start,scheduled_end,status,blocks_calendar,subtotal_minor,platform_fee_minor,total_minor,seller_net_minor,currency,price_snapshot,cancellation_policy_snapshot,confirmed_at)
  values (v_booking_id,v_user,v_quote.seller_id,v_request.id,v_quote.id,v_quote.service_id,v_request.address_id,v_request.household_member_id,v_quote.starts_at,v_quote.ends_at,'confirmed',true,v_quote.base_minor+v_quote.travel_minor,v_quote.platform_fee_minor,v_quote.total_minor,v_seller_net,v_quote.currency,jsonb_build_object('base_minor',v_quote.base_minor,'travel_minor',v_quote.travel_minor,'platform_fee_minor',v_quote.platform_fee_minor),v_quote.policy_snapshot,now());
  update public.booking_requests set status='confirmed' where id=v_request.id;

  insert into public.payment_intents (id,booking_id,request_id,payer_id,processor,external_ref,amount_minor,currency,status,idempotency_key,captured_minor,authorized_at,captured_at)
  values (v_payment_id,v_booking_id,v_request.id,v_user,'simulation','sim_'||substr(replace(v_payment_id::text,'-',''),1,18),v_quote.total_minor,v_quote.currency,'captured',p_idempotency_key,v_quote.total_minor,now(),now());

  select id into v_buyer_account from public.ledger_accounts where account_type='buyer_wallet' and owner_user_id=v_user and currency=v_quote.currency;
  insert into public.ledger_accounts (account_type,owner_user_id,currency) values ('protected_funds',null,v_quote.currency) on conflict do nothing;
  select id into v_protected_account from public.ledger_accounts where account_type='protected_funds' and owner_user_id is null and currency=v_quote.currency;
  insert into public.ledger_transactions (id,reference_type,reference_id,event_type,currency,description,idempotency_key)
  values (v_tx_id,'booking',v_booking_id,'payment_captured',v_quote.currency,'Simulated protected payment captured','capture:'||p_idempotency_key);
  insert into public.ledger_entries (transaction_id,account_id,direction,amount_minor,booking_id,buyer_id,seller_id)
  values (v_tx_id,v_buyer_account,'debit',v_quote.total_minor,v_booking_id,v_user,v_quote.seller_id),
         (v_tx_id,v_protected_account,'credit',v_quote.total_minor,v_booking_id,v_user,v_quote.seller_id);

  insert into public.booking_participants (booking_id,user_id,role) values (v_booking_id,v_user,'buyer'),(v_booking_id,v_quote.seller_id,'seller');
  insert into public.booking_status_history (booking_id,to_status,actor_id,reason_code,idempotency_key) values (v_booking_id,'confirmed',v_user,'quote_accepted',p_idempotency_key);
  insert into public.conversations (id,conversation_type,booking_id,status) values (v_conversation_id,'booking',v_booking_id,'active');
  insert into public.conversation_members (conversation_id,user_id,role) values (v_conversation_id,v_user,'buyer'),(v_conversation_id,v_quote.seller_id,'seller');
  insert into public.domain_events (aggregate_type,aggregate_id,event_type,payload_redacted) values ('booking',v_booking_id,'booking.confirmed',jsonb_build_object('buyer_id',v_user,'seller_id',v_quote.seller_id));
  insert into public.notification_outbox (recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
  values (v_quote.seller_id,'booking_confirmed','booking','high',jsonb_build_object('booking_id',v_booking_id),'booking_confirmed:'||v_booking_id::text||':'||v_quote.seller_id::text),
         (v_user,'payment_captured','payments','normal',jsonb_build_object('booking_id',v_booking_id,'amount_minor',v_quote.total_minor),'payment_captured:'||v_booking_id::text);
  return jsonb_build_object('ok',true,'booking_id',v_booking_id,'payment_intent_id',v_payment_id,'reference',(select reference from public.bookings where id=v_booking_id));
end;
$$;

create or replace function public.accept_quote_with_simulated_payment(p_quote_id uuid, p_idempotency_key text)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.accept_quote_with_simulated_payment(p_quote_id,p_idempotency_key); $$;

create or replace function app_private.transition_booking(p_booking_id uuid,p_target public.booking_status,p_reason text,p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_allowed boolean := false;
  v_blocks boolean;
  v_tx_id uuid;
  v_protected uuid;
  v_seller_wallet uuid;
  v_platform uuid;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key)<8 then raise exception 'idempotency_key_required'; end if;
  if exists(select 1 from public.booking_status_history where booking_id=p_booking_id and idempotency_key=p_idempotency_key) then
    return jsonb_build_object('ok',true,'booking_id',p_booking_id,'replayed',true);
  end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;

  v_allowed :=
    (v_user=v_booking.seller_id and v_booking.status='confirmed' and p_target='in_progress') or
    (v_user=v_booking.seller_id and v_booking.status='in_progress' and p_target='completion_pending') or
    (v_user=v_booking.buyer_id and v_booking.status='completion_pending' and p_target='completed') or
    (v_user in (v_booking.buyer_id,v_booking.seller_id) and v_booking.status in ('confirmed','requested','offered') and p_target='cancelled') or
    (v_user in (v_booking.buyer_id,v_booking.seller_id) and v_booking.status in ('confirmed','in_progress','completion_pending','completed') and p_target='disputed') or
    app_private.has_admin_permission('bookings.manage');
  if not v_allowed then raise exception 'transition_not_allowed'; end if;

  v_blocks := p_target in ('confirmed','in_progress','completion_pending');
  update public.bookings set status=p_target,blocks_calendar=v_blocks,version=version+1,
    started_at=case when p_target='in_progress' then now() else started_at end,
    ended_at=case when p_target='completion_pending' then now() else ended_at end,
    completed_at=case when p_target='completed' then now() else completed_at end,
    cancelled_at=case when p_target='cancelled' then now() else cancelled_at end
  where id=p_booking_id;
  insert into public.booking_status_history (booking_id,from_status,to_status,actor_id,reason_code,idempotency_key)
  values (p_booking_id,v_booking.status,p_target,v_user,left(coalesce(p_reason,'user_action'),80),p_idempotency_key);

  if p_target='completed' then
    insert into public.ledger_accounts (account_type,owner_user_id,currency) values ('seller_wallet',v_booking.seller_id,v_booking.currency) on conflict do nothing;
    insert into public.ledger_accounts (account_type,owner_user_id,currency) values ('platform_revenue',null,v_booking.currency) on conflict do nothing;
    select id into v_protected from public.ledger_accounts where account_type='protected_funds' and owner_user_id is null and currency=v_booking.currency;
    select id into v_seller_wallet from public.ledger_accounts where account_type='seller_wallet' and owner_user_id=v_booking.seller_id and currency=v_booking.currency;
    select id into v_platform from public.ledger_accounts where account_type='platform_revenue' and owner_user_id is null and currency=v_booking.currency;
    v_tx_id := gen_random_uuid();
    insert into public.ledger_transactions (id,reference_type,reference_id,event_type,currency,description,idempotency_key)
    values (v_tx_id,'booking',v_booking.id,'funds_released',v_booking.currency,'Simulated booking funds released','release:'||v_booking.id::text);
    insert into public.ledger_entries (transaction_id,account_id,direction,amount_minor,booking_id,buyer_id,seller_id)
    values (v_tx_id,v_protected,'debit',v_booking.total_minor,v_booking.id,v_booking.buyer_id,v_booking.seller_id),
           (v_tx_id,v_seller_wallet,'credit',v_booking.seller_net_minor,v_booking.id,v_booking.buyer_id,v_booking.seller_id);
    if v_booking.total_minor>v_booking.seller_net_minor then
      insert into public.ledger_entries (transaction_id,account_id,direction,amount_minor,booking_id,buyer_id,seller_id)
      values (v_tx_id,v_platform,'credit',v_booking.total_minor-v_booking.seller_net_minor,v_booking.id,v_booking.buyer_id,v_booking.seller_id);
    end if;
    update public.seller_profiles set completed_bookings=completed_bookings+1 where user_id=v_booking.seller_id;
  end if;

  insert into public.domain_events (aggregate_type,aggregate_id,event_type,payload_redacted)
  values ('booking',p_booking_id,'booking.'||p_target::text,jsonb_build_object('actor_id',v_user,'from',v_booking.status,'to',p_target));
  insert into public.notification_outbox (recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
  select party_id,'booking_status_changed','booking',case when p_target in ('cancelled','disputed') then 'high'::public.case_priority else 'normal'::public.case_priority end,
    jsonb_build_object('booking_id',p_booking_id,'status',p_target),
    'booking_status:'||p_booking_id::text||':'||p_target::text||':'||party_id::text
  from (values(v_booking.buyer_id),(v_booking.seller_id)) p(party_id);
  return jsonb_build_object('ok',true,'booking_id',p_booking_id,'status',p_target,'version',v_booking.version+1);
end;
$$;

create or replace function public.transition_booking(p_booking_id uuid,p_target public.booking_status,p_reason text default null,p_idempotency_key text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select app_private.transition_booking(p_booking_id,p_target,p_reason,p_idempotency_key); $$;

create or replace function app_private.submit_verified_review(p_booking_id uuid,p_rating smallint,p_body text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_subject uuid;
  v_role public.app_role;
  v_review uuid;
  v_publish boolean;
begin
  select * into v_booking from public.bookings where id=p_booking_id;
  if not found or v_booking.status <> 'completed' or v_user not in (v_booking.buyer_id,v_booking.seller_id) then raise exception 'review_not_eligible'; end if;
  if p_rating not between 1 and 5 or char_length(coalesce(p_body,''))>2000 then raise exception 'invalid_review'; end if;
  v_subject := case when v_user=v_booking.buyer_id then v_booking.seller_id else v_booking.buyer_id end;
  v_role := case when v_subject=v_booking.seller_id then 'seller'::public.app_role else 'buyer'::public.app_role end;
  v_publish := exists(select 1 from public.reviews where booking_id=p_booking_id and author_id=v_subject) or v_booking.completed_at < now()-interval '7 days';
  insert into public.reviews (booking_id,author_id,subject_id,subject_role,overall_rating,body,status,published_at)
  values (p_booking_id,v_user,v_subject,v_role,p_rating,nullif(trim(p_body),''),case when v_publish then 'published' else 'pending_peer' end,case when v_publish then now() end)
  returning id into v_review;
  if v_publish then
    update public.reviews set status='published',published_at=coalesce(published_at,now()) where booking_id=p_booking_id and status='pending_peer';
  end if;
  update public.seller_profiles sp set rating_average=s.avg_rating,rating_count=s.rating_count
  from (select subject_id,round(avg(overall_rating)::numeric,2) avg_rating,count(*)::int rating_count from public.reviews where subject_id=v_booking.seller_id and status='published' group by subject_id) s
  where sp.user_id=s.subject_id;
  return jsonb_build_object('ok',true,'review_id',v_review,'published',v_publish);
end;
$$;

create or replace function public.submit_verified_review(p_booking_id uuid,p_rating smallint,p_body text default '')
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.submit_verified_review(p_booking_id,p_rating,p_body); $$;

create or replace function app_private.admin_user_action(p_target_user_id uuid,p_action text,p_reason text,p_until timestamptz)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_admin uuid := (select auth.uid()); v_before jsonb; v_status public.account_status;
begin
  if not app_private.has_admin_permission('users.enforce') then raise exception 'permission_denied'; end if;
  if p_target_user_id=v_admin then raise exception 'self_enforcement_not_allowed'; end if;
  if char_length(trim(coalesce(p_reason,'')))<5 then raise exception 'reason_required'; end if;
  select to_jsonb(p.*)-'first_name_private'-'last_name_private'-'date_of_birth_private' into v_before from public.profiles p where id=p_target_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  v_status := case p_action when 'suspend' then 'suspended' when 'restrict' then 'restricted' when 'ban' then 'closed' when 'restore' then 'active' else null end;
  if v_status is null then raise exception 'invalid_action'; end if;
  update public.profiles set account_status=v_status,suspended_reason=case when v_status='active' then null else left(p_reason,1000) end,suspended_until=case when p_action='suspend' then p_until else null end where id=p_target_user_id;
  update public.seller_profiles set status=case when p_action in ('suspend','ban') then 'suspended'::public.seller_status when p_action='restore' and status='suspended' then 'under_review'::public.seller_status else status end where user_id=p_target_user_id;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,before_redacted,after_redacted,reason)
  values(v_admin,'user.'||p_action,'user',p_target_user_id,v_before,jsonb_build_object('account_status',v_status,'until',p_until),p_reason);
  return jsonb_build_object('ok',true,'user_id',p_target_user_id,'status',v_status);
end;
$$;

create or replace function public.admin_user_action(p_target_user_id uuid,p_action text,p_reason text,p_until timestamptz default null)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.admin_user_action(p_target_user_id,p_action,p_reason,p_until); $$;

create or replace function app_private.admin_review_verification(p_case_id uuid,p_decision public.verification_status,p_note text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_admin uuid := (select auth.uid()); v_case public.verification_cases%rowtype;
begin
  if not app_private.has_admin_permission('kyc.review') then raise exception 'permission_denied'; end if;
  if p_decision not in ('approved','rejected','needs_information') then raise exception 'invalid_decision'; end if;
  if char_length(trim(coalesce(p_note,'')))<3 then raise exception 'decision_note_required'; end if;
  select * into v_case from public.verification_cases where id=p_case_id for update;
  if not found then raise exception 'case_not_found'; end if;
  update public.verification_cases set status=p_decision,decision_reason=left(p_note,2000),admin_reviewer_id=v_admin,decided_at=now() where id=p_case_id;
  update public.seller_profiles set status=case when p_decision='approved' then 'approved' when p_decision='rejected' then 'rejected' else 'needs_information' end,
    approved_at=case when p_decision='approved' then now() else approved_at end where user_id=v_case.seller_id;
  update public.seller_documents set status=p_decision where seller_id=v_case.seller_id and status in ('pending','needs_information');
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,after_redacted,reason)
  values(v_admin,'verification.'||p_decision::text,'verification_case',p_case_id,jsonb_build_object('seller_id',v_case.seller_id,'decision',p_decision),p_note);
  insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
  values(v_case.seller_id,'verification_decision','account','high',jsonb_build_object('case_id',p_case_id,'status',p_decision),'verification:'||p_case_id::text||':'||p_decision::text);
  return jsonb_build_object('ok',true,'case_id',p_case_id,'seller_id',v_case.seller_id,'status',p_decision);
end;
$$;

create or replace function public.admin_review_verification(p_case_id uuid,p_decision public.verification_status,p_note text)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.admin_review_verification(p_case_id,p_decision,p_note); $$;

create or replace function app_private.admin_conversation_messages(p_conversation_id uuid,p_purpose_code text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_admin uuid := (select auth.uid()); v_payload jsonb;
begin
  if not app_private.has_admin_permission('messages.read') then raise exception 'permission_denied'; end if;
  if char_length(trim(coalesce(p_purpose_code,'')))<3 then raise exception 'purpose_required'; end if;
  insert into public.admin_access_logs(admin_user_id,resource_type,resource_id,purpose_code,fields_accessed)
  values(v_admin,'conversation',p_conversation_id,p_purpose_code,array['sender_id','body','created_at']);
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'sender_id',m.sender_id,'body',m.body,'message_type',m.message_type,'created_at',m.created_at) order by m.created_at),'[]'::jsonb)
  into v_payload from public.messages m where m.conversation_id=p_conversation_id and m.deleted_at is null;
  return v_payload;
end;
$$;

create or replace function public.admin_conversation_messages(p_conversation_id uuid,p_purpose_code text)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.admin_conversation_messages(p_conversation_id,p_purpose_code); $$;

revoke all on all functions in schema app_private from public, anon, authenticated;
grant execute on function app_private.has_role(public.app_role), app_private.has_admin_permission(text), app_private.is_booking_party(uuid), app_private.is_request_party(uuid), app_private.is_conversation_member(uuid), app_private.safe_uuid(text) to authenticated;
grant execute on function app_private.activate_seller_profile(text), app_private.submit_seller_quote(uuid,bigint,bigint,text,timestamptz), app_private.accept_quote_with_simulated_payment(uuid,text), app_private.transition_booking(uuid,public.booking_status,text,text), app_private.submit_verified_review(uuid,smallint,text), app_private.admin_user_action(uuid,text,text,timestamptz), app_private.admin_review_verification(uuid,public.verification_status,text), app_private.admin_conversation_messages(uuid,text) to authenticated;

do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I enable row level security',r.tablename);
  end loop;
end $$;

create policy profiles_self_admin_select on public.profiles for select to authenticated using ((select auth.uid())=id or app_private.has_admin_permission('users.read'));
create policy profiles_self_update on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy roles_self_admin_select on public.user_roles for select to authenticated using ((select auth.uid())=user_id or app_private.has_admin_permission('users.read'));
create policy roles_self_insert on public.user_roles for insert to authenticated with check ((select auth.uid())=user_id and role in ('buyer','seller'));
create policy admin_permissions_admin_select on public.admin_permissions for select to authenticated using (app_private.has_admin_permission('admins.manage') or admin_user_id=(select auth.uid()));
create policy preferences_self on public.user_preferences for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy notification_preferences_self on public.notification_preferences for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy households_owner on public.households for all to authenticated using (owner_user_id=(select auth.uid()) or app_private.has_admin_permission('users.read')) with check (owner_user_id=(select auth.uid()) or app_private.has_admin_permission('users.manage'));
create policy household_members_owner on public.household_members for all to authenticated using (exists(select 1 from public.households h where h.id=household_id and (h.owner_user_id=(select auth.uid()) or app_private.has_admin_permission('users.read')))) with check (exists(select 1 from public.households h where h.id=household_id and h.owner_user_id=(select auth.uid())));
create policy addresses_owner on public.addresses for all to authenticated using (owner_user_id=(select auth.uid()) or app_private.has_admin_permission('users.read')) with check (owner_user_id=(select auth.uid()) or app_private.has_admin_permission('users.manage'));
create policy emergency_contacts_owner on public.emergency_contacts for all to authenticated using (user_id=(select auth.uid()) or app_private.has_admin_permission('users.read')) with check (user_id=(select auth.uid()));

create policy islands_public_read on public.islands for select to anon,authenticated using (active or app_private.has_admin_permission('catalog.manage'));
create policy service_areas_public_read on public.service_areas for select to anon,authenticated using (active or app_private.has_admin_permission('catalog.manage'));
create policy categories_public_read on public.service_categories for select to anon,authenticated using (active or app_private.has_admin_permission('catalog.manage'));
create policy services_public_read on public.services for select to anon,authenticated using (active or app_private.has_admin_permission('catalog.manage'));
create policy catalog_admin_categories on public.service_categories for all to authenticated using (app_private.has_admin_permission('catalog.manage')) with check (app_private.has_admin_permission('catalog.manage'));
create policy catalog_admin_services on public.services for all to authenticated using (app_private.has_admin_permission('catalog.manage')) with check (app_private.has_admin_permission('catalog.manage'));

create policy seller_profiles_public_owner_admin on public.seller_profiles for select to anon,authenticated using ((status='approved' and profile_published_at is not null) or user_id=(select auth.uid()) or app_private.has_admin_permission('sellers.read'));
create policy seller_profiles_owner_update on public.seller_profiles for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy seller_services_public_owner_admin on public.seller_services for select to anon,authenticated using ((active and exists(select 1 from public.seller_profiles sp where sp.user_id=seller_id and sp.status='approved' and sp.profile_published_at is not null)) or seller_id=(select auth.uid()) or app_private.has_admin_permission('sellers.read'));
create policy seller_services_owner on public.seller_services for all to authenticated using (seller_id=(select auth.uid()) or app_private.has_admin_permission('sellers.manage')) with check (seller_id=(select auth.uid()) or app_private.has_admin_permission('sellers.manage'));
create policy seller_areas_public_owner on public.seller_service_areas for select to anon,authenticated using (active or seller_id=(select auth.uid()) or app_private.has_admin_permission('sellers.read'));
create policy seller_areas_owner_manage on public.seller_service_areas for all to authenticated using (seller_id=(select auth.uid())) with check (seller_id=(select auth.uid()));
create policy availability_public_owner on public.availability_rules for select to anon,authenticated using (active or seller_id=(select auth.uid()) or app_private.has_admin_permission('sellers.read'));
create policy availability_owner_manage on public.availability_rules for all to authenticated using (seller_id=(select auth.uid())) with check (seller_id=(select auth.uid()));
create policy availability_exceptions_owner on public.availability_exceptions for all to authenticated using (seller_id=(select auth.uid()) or app_private.has_admin_permission('sellers.read')) with check (seller_id=(select auth.uid()));
create policy seller_documents_owner_admin on public.seller_documents for select to authenticated using (seller_id=(select auth.uid()) or app_private.has_admin_permission('kyc.review'));
create policy seller_documents_owner_insert on public.seller_documents for insert to authenticated with check (seller_id=(select auth.uid()));
create policy verification_cases_owner_admin on public.verification_cases for select to authenticated using (seller_id=(select auth.uid()) or app_private.has_admin_permission('kyc.review'));
create policy verification_cases_owner_insert on public.verification_cases for insert to authenticated with check (seller_id=(select auth.uid()));
create policy credentials_public_owner_admin on public.seller_credentials for select to anon,authenticated using ((status='approved') or seller_id=(select auth.uid()) or app_private.has_admin_permission('kyc.review'));

create policy requests_buyer_market_admin_select on public.booking_requests for select to authenticated using (buyer_id=(select auth.uid()) or (status in ('requested','offered') and app_private.has_role('seller')) or app_private.has_admin_permission('bookings.read'));
create policy requests_buyer_insert on public.booking_requests for insert to authenticated with check (buyer_id=(select auth.uid()) and app_private.has_role('buyer'));
create policy requests_buyer_update on public.booking_requests for update to authenticated using (buyer_id=(select auth.uid()) and status in ('draft','requested','offered')) with check (buyer_id=(select auth.uid()));
create policy request_private_buyer_admin on public.booking_request_private for select to authenticated using (buyer_id=(select auth.uid()) or app_private.has_admin_permission('bookings.read'));
create policy request_private_buyer_insert on public.booking_request_private for insert to authenticated with check (buyer_id=(select auth.uid()));
create policy quotes_parties_admin on public.booking_quotes for select to authenticated using (buyer_id=(select auth.uid()) or seller_id=(select auth.uid()) or app_private.has_admin_permission('bookings.read'));
create policy offers_parties_admin on public.booking_offers for select to authenticated using (seller_id=(select auth.uid()) or exists(select 1 from public.booking_requests r where r.id=request_id and r.buyer_id=(select auth.uid())) or app_private.has_admin_permission('bookings.read'));
create policy bookings_parties_admin on public.bookings for select to authenticated using (buyer_id=(select auth.uid()) or seller_id=(select auth.uid()) or app_private.has_admin_permission('bookings.read'));
create policy booking_history_parties_admin on public.booking_status_history for select to authenticated using (app_private.is_booking_party(booking_id) or app_private.has_admin_permission('bookings.read'));
create policy booking_participants_parties_admin on public.booking_participants for select to authenticated using (app_private.is_booking_party(booking_id) or app_private.has_admin_permission('bookings.read'));
create policy session_codes_parties_admin on public.booking_session_codes for select to authenticated using (app_private.is_booking_party(booking_id) or app_private.has_admin_permission('bookings.manage'));
create policy checkins_parties_admin on public.booking_checkins for select to authenticated using (app_private.is_booking_party(booking_id) or app_private.has_admin_permission('bookings.read'));

create policy conversations_members_admin on public.conversations for select to authenticated using (app_private.is_conversation_member(id) or app_private.has_admin_permission('messages.read'));
create policy conversation_members_self_admin on public.conversation_members for select to authenticated using (app_private.is_conversation_member(conversation_id) or app_private.has_admin_permission('messages.read'));
create policy messages_members_only on public.messages for select to authenticated using (app_private.is_conversation_member(conversation_id));
create policy messages_member_insert on public.messages for insert to authenticated with check (sender_id=(select auth.uid()) and app_private.is_conversation_member(conversation_id));
create policy attachments_members_only on public.message_attachments for select to authenticated using (exists(select 1 from public.messages m where m.id=message_id and app_private.is_conversation_member(m.conversation_id)));

create policy payment_methods_owner_admin on public.payment_methods for all to authenticated using (user_id=(select auth.uid()) or app_private.has_admin_permission('finance.read')) with check (user_id=(select auth.uid()));
create policy payment_intents_buyer_admin on public.payment_intents for select to authenticated using (payer_id=(select auth.uid()) or app_private.has_admin_permission('finance.read'));
create policy ledger_accounts_owner_admin on public.ledger_accounts for select to authenticated using (owner_user_id=(select auth.uid()) or app_private.has_admin_permission('finance.read'));
create policy ledger_entries_owner_admin on public.ledger_entries for select to authenticated using (exists(select 1 from public.ledger_accounts a where a.id=account_id and (a.owner_user_id=(select auth.uid()) or app_private.has_admin_permission('finance.read'))));
create policy refunds_parties_admin on public.refunds for select to authenticated using (requested_by=(select auth.uid()) or exists(select 1 from public.bookings b where b.id=booking_id and b.seller_id=(select auth.uid())) or app_private.has_admin_permission('finance.read'));
create policy payouts_seller_admin on public.payouts for select to authenticated using (seller_id=(select auth.uid()) or app_private.has_admin_permission('finance.read'));

create policy reviews_public on public.reviews for select to anon,authenticated using (status='published' or author_id=(select auth.uid()) or subject_id=(select auth.uid()) or app_private.has_admin_permission('moderation.read'));
create policy badges_public on public.badges for select to anon,authenticated using ((active and public) or app_private.has_admin_permission('badges.manage'));
create policy user_badges_public on public.user_badges for select to anon,authenticated using ((revoked_at is null and exists(select 1 from public.badges b where b.id=badge_id and b.public)) or user_id=(select auth.uid()) or app_private.has_admin_permission('badges.manage'));
create policy disputes_parties_admin on public.service_disputes for select to authenticated using (app_private.is_booking_party(booking_id) or app_private.has_admin_permission('disputes.manage'));
create policy disputes_party_insert on public.service_disputes for insert to authenticated with check (opened_by=(select auth.uid()) and app_private.is_booking_party(booking_id));
create policy moderation_reporter_admin on public.moderation_reports for select to authenticated using (reporter_id=(select auth.uid()) or app_private.has_admin_permission('moderation.read'));
create policy moderation_reporter_insert on public.moderation_reports for insert to authenticated with check (reporter_id=(select auth.uid()));

create policy notifications_recipient on public.notifications for select to authenticated using (recipient_id=(select auth.uid()) or app_private.has_admin_permission('notifications.read'));
create policy notifications_recipient_update on public.notifications for update to authenticated using (recipient_id=(select auth.uid())) with check (recipient_id=(select auth.uid()));
create policy notification_outbox_admin on public.notification_outbox for select to authenticated using (recipient_id=(select auth.uid()) or app_private.has_admin_permission('notifications.read'));
create policy notification_deliveries_admin on public.notification_deliveries for select to authenticated using (exists(select 1 from public.notification_outbox o where o.id=outbox_id and o.recipient_id=(select auth.uid())) or app_private.has_admin_permission('notifications.read'));
create policy admin_audit_admin on public.admin_audit_logs for select to authenticated using (app_private.has_admin_permission('audit.read'));
create policy admin_access_admin on public.admin_access_logs for select to authenticated using (app_private.has_admin_permission('audit.read'));
create policy feature_flags_authenticated_read on public.feature_flags for select to authenticated using (true);
create policy feature_flags_admin_manage on public.feature_flags for all to authenticated using (app_private.has_admin_permission('config.manage')) with check (app_private.has_admin_permission('config.manage'));
create policy settings_authenticated_read on public.system_settings for select to authenticated using (true);
create policy settings_admin_manage on public.system_settings for all to authenticated using (app_private.has_admin_permission('config.manage')) with check (app_private.has_admin_permission('config.manage'));

revoke all on all tables in schema public from anon, authenticated;
grant select on public.islands,public.service_areas,public.service_categories,public.services,public.seller_profiles,public.seller_services,public.seller_service_areas,public.availability_rules,public.seller_credentials,public.reviews,public.badges,public.user_badges to anon;
grant select on all tables in schema public to authenticated;
grant insert,update on public.profiles,public.user_preferences,public.notification_preferences,public.households,public.household_members,public.addresses,public.emergency_contacts,public.seller_profiles,public.seller_services,public.seller_service_areas,public.availability_rules,public.availability_exceptions,public.seller_documents,public.verification_cases,public.booking_requests,public.booking_request_private,public.messages,public.payment_methods,public.notifications,public.service_disputes,public.moderation_reports,public.feature_flags,public.system_settings to authenticated;
grant delete on public.households,public.household_members,public.addresses,public.emergency_contacts,public.seller_services,public.seller_service_areas,public.availability_rules,public.availability_exceptions,public.payment_methods to authenticated;
grant insert on public.user_roles to authenticated;

grant execute on function public.activate_seller_profile(text),public.submit_seller_quote(uuid,bigint,bigint,text,timestamptz),public.accept_quote_with_simulated_payment(uuid,text),public.transition_booking(uuid,public.booking_status,text,text),public.submit_verified_review(uuid,smallint,text),public.admin_user_action(uuid,text,text,timestamptz),public.admin_review_verification(uuid,public.verification_status,text),public.admin_conversation_messages(uuid,text) to authenticated;
revoke execute on all functions in schema public from anon;

create or replace view public.wallet_balances with (security_invoker=true) as
select a.id as account_id,a.owner_user_id,a.account_type,a.currency,a.status,
  coalesce(sum(case e.direction when 'credit' then e.amount_minor else -e.amount_minor end),0)::bigint as balance_minor,
  max(e.created_at) as last_activity_at
from public.ledger_accounts a left join public.ledger_entries e on e.account_id=a.id
group by a.id;
grant select on public.wallet_balances to authenticated;

create or replace view public.seller_directory with (security_invoker=true) as
select sp.user_id,sp.public_slug,sp.display_name,sp.headline,sp.bio,sp.years_experience,sp.languages,sp.avatar_path,sp.locality,
  i.name as island,sp.rating_average,sp.rating_count,sp.completed_bookings,sp.response_rate,
  coalesce(jsonb_agg(distinct jsonb_build_object('service_id',s.id,'name',s.name,'slug',s.slug,'rate_minor',ss.rate_minor,'currency',ss.currency)) filter(where ss.id is not null),'[]'::jsonb) as services,
  coalesce(jsonb_agg(distinct jsonb_build_object('code',b.code,'name',b.name,'icon',b.icon_key)) filter(where ub.id is not null and ub.revoked_at is null),'[]'::jsonb) as badges
from public.seller_profiles sp
left join public.islands i on i.id=sp.island_id
left join public.seller_services ss on ss.seller_id=sp.user_id and ss.active
left join public.services s on s.id=ss.service_id and s.active
left join public.user_badges ub on ub.user_id=sp.user_id and ub.revoked_at is null and (ub.expires_at is null or ub.expires_at>now())
left join public.badges b on b.id=ub.badge_id and b.active and b.public
where sp.status='approved' and sp.profile_published_at is not null
group by sp.user_id,i.name;
grant select on public.seller_directory to anon,authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
('public-profile-media','public-profile-media',true,5242880,array['image/jpeg','image/png','image/webp']),
('seller-documents','seller-documents',false,10485760,array['image/jpeg','image/png','application/pdf']),
('booking-attachments','booking-attachments',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf']),
('case-evidence','case-evidence',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf']),
('receipts-statements','receipts-statements',false,10485760,array['application/pdf','text/csv']),
('exports','exports',false,52428800,array['application/zip','text/csv','application/json'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy storage_profile_media_read on storage.objects for select to anon,authenticated using (bucket_id='public-profile-media');
create policy storage_profile_media_insert on storage.objects for insert to authenticated with check (bucket_id='public-profile-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy storage_profile_media_update on storage.objects for update to authenticated using (bucket_id='public-profile-media' and owner_id=(select auth.uid())::text) with check (bucket_id='public-profile-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy storage_profile_media_delete on storage.objects for delete to authenticated using (bucket_id='public-profile-media' and owner_id=(select auth.uid())::text);
create policy storage_seller_docs_select on storage.objects for select to authenticated using (bucket_id='seller-documents' and owner_id=(select auth.uid())::text);
create policy storage_seller_docs_insert on storage.objects for insert to authenticated with check (bucket_id='seller-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy storage_seller_docs_update on storage.objects for update to authenticated using (bucket_id='seller-documents' and owner_id=(select auth.uid())::text) with check (bucket_id='seller-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy storage_booking_select on storage.objects for select to authenticated using (bucket_id='booking-attachments' and app_private.is_booking_party(app_private.safe_uuid(split_part(name,'/',1))));
create policy storage_booking_insert on storage.objects for insert to authenticated with check (bucket_id='booking-attachments' and app_private.is_booking_party(app_private.safe_uuid(split_part(name,'/',1))));
create policy storage_case_select on storage.objects for select to authenticated using (bucket_id='case-evidence' and (owner_id=(select auth.uid())::text or app_private.has_admin_permission('disputes.manage')));
create policy storage_case_insert on storage.objects for insert to authenticated with check (bucket_id='case-evidence' and (storage.foldername(name))[2]=(select auth.uid())::text);
create policy storage_receipts_select on storage.objects for select to authenticated using (bucket_id='receipts-statements' and ((storage.foldername(name))[1]=(select auth.uid())::text or app_private.has_admin_permission('finance.read')));
create policy storage_exports_select on storage.objects for select to authenticated using (bucket_id='exports' and ((storage.foldername(name))[1]=(select auth.uid())::text or app_private.has_admin_permission('privacy.manage')));

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.booking_offers;

commit;
