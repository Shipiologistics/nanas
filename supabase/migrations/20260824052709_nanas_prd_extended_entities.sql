begin;

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(), document_type text not null, version integer not null, locale text not null default 'en-BS',
  effective_at timestamptz not null, content_url text not null, checksum text not null, active boolean not null default true,
  created_at timestamptz not null default now(), unique(document_type,version,locale)
);
create table public.consents (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), document_id uuid references public.legal_documents(id),
  consent_type text not null, status text not null check(status in('granted','withdrawn','expired')), scope jsonb not null default '{}',
  captured_at timestamptz not null default now(), withdrawn_at timestamptz, ip_hash text, user_agent_hash text, created_at timestamptz not null default now()
);
create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), request_type text not null check(request_type in('export','delete','correct')),
  status public.case_status not null default 'open', identity_verified_at timestamptz, due_at timestamptz, completed_at timestamptz,
  retention_exceptions jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.devices (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), platform text not null,
  push_vendor text not null, token_ciphertext text not null, token_hash text not null unique, app_version text, locale text default 'en-BS',
  last_seen_at timestamptz not null default now(), revoked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.blocks (
  blocker_user_id uuid not null references public.profiles(id), blocked_user_id uuid not null references public.profiles(id), reason_code text,
  created_at timestamptz not null default now(), primary key(blocker_user_id,blocked_user_id), check(blocker_user_id<>blocked_user_id)
);

create table public.service_extras (
  id uuid primary key default gen_random_uuid(), service_id uuid not null references public.services(id), name text not null, description text,
  price_type text not null check(price_type in('fixed','per_hour','percentage')), price_value bigint not null check(price_value>=0), duration_impact_minutes integer not null default 0,
  minimum_quantity integer not null default 0, maximum_quantity integer not null default 1, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(maximum_quantity>=minimum_quantity)
);
create table public.cancellation_policies (
  id uuid primary key default gen_random_uuid(), name text not null, version integer not null, rules jsonb not null, effective_at timestamptz not null,
  active boolean not null default true, created_at timestamptz not null default now(), unique(name,version)
);
create table public.commission_rules (
  id uuid primary key default gen_random_uuid(), service_id uuid references public.services(id), service_area_id uuid references public.service_areas(id), seller_id uuid references public.seller_profiles(user_id),
  fee_type text not null check(fee_type in('fixed','percentage')), fee_value bigint not null check(fee_value>=0), minimum_minor bigint, maximum_minor bigint,
  currency char(3) not null default 'BSD', priority integer not null default 0, valid_from timestamptz, valid_until timestamptz, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.travel_pricing_rules (
  id uuid primary key default gen_random_uuid(), seller_id uuid references public.seller_profiles(user_id), service_id uuid references public.services(id), service_area_id uuid references public.service_areas(id),
  included_km numeric(6,2) not null default 0, fee_per_km_minor bigint not null default 0, maximum_minor bigint, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.promotion_codes (
  id uuid primary key default gen_random_uuid(), code_normalized text not null unique, discount_rules jsonb not null, eligibility jsonb not null default '{}',
  budget_minor bigint, per_user_limit integer not null default 1, valid_from timestamptz, valid_until timestamptz, status text not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(), promotion_id uuid not null references public.promotion_codes(id), user_id uuid not null references public.profiles(id),
  booking_id uuid references public.bookings(id), amount_minor bigint not null check(amount_minor>=0), status text not null default 'applied', created_at timestamptz not null default now()
);
create table public.tax_rules (
  id uuid primary key default gen_random_uuid(), jurisdiction text not null, service_id uuid references public.services(id), calculation_rules jsonb not null,
  effective_from date not null, effective_until date, validated_by text, active boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.seller_languages (
  seller_id uuid not null references public.seller_profiles(user_id), language_tag text not null, proficiency text not null check(proficiency in('basic','conversational','fluent','native')),
  created_at timestamptz not null default now(), primary key(seller_id,language_tag)
);
create table public.seller_portfolio_assets (
  id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.seller_profiles(user_id), storage_path text not null unique,
  media_type text not null, caption text, sort_order integer not null default 0, moderation_status public.moderation_status not null default 'pending', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.seller_offer_rules (
  id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.seller_profiles(user_id), service_id uuid references public.services(id), service_area_id uuid references public.service_areas(id),
  constraints jsonb not null default '{}', action text not null default 'notify' check(action in('notify','auto_decline','auto_accept')), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.background_checks (
  id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.seller_profiles(user_id), verification_case_id uuid references public.verification_cases(id),
  consent_id uuid references public.consents(id), vendor text not null default 'manual', external_ref text, status public.verification_status not null default 'pending',
  completed_at timestamptz, expires_at timestamptz, permitted_summary text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.payout_accounts (
  id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.seller_profiles(user_id), processor text not null default 'simulation',
  external_account_ref text not null, onboarding_status text not null default 'pending', capability_flags jsonb not null default '{}', display_label text, last4 char(4),
  is_default boolean not null default false, disabled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index payout_accounts_one_default on public.payout_accounts(seller_id) where is_default and disabled_at is null;
create table public.seller_status_history (
  id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.seller_profiles(user_id), from_status public.seller_status,
  to_status public.seller_status not null, actor_id uuid references public.profiles(id), reason_code text, note text, created_at timestamptz not null default now()
);

create table public.favorites (
  buyer_id uuid not null references public.profiles(id), seller_id uuid not null references public.seller_profiles(user_id), created_at timestamptz not null default now(), primary key(buyer_id,seller_id)
);
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(), buyer_id uuid not null references public.profiles(id), label text not null, filters jsonb not null, alert_opt_in boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.match_runs (
  id uuid primary key default gen_random_uuid(), buyer_id uuid not null references public.profiles(id), request_id uuid references public.booking_requests(id),
  algorithm_version text not null, sanitized_inputs jsonb not null, created_at timestamptz not null default now()
);
create table public.match_candidates (
  match_run_id uuid not null references public.match_runs(id) on delete cascade, seller_id uuid not null references public.seller_profiles(user_id),
  score numeric(8,4) not null, rank integer not null, reason_codes text[] not null default '{}', eligibility_snapshot jsonb not null default '{}', excluded_reason_private text,
  created_at timestamptz not null default now(), primary key(match_run_id,seller_id)
);
create table public.booking_extras (
  booking_id uuid not null references public.bookings(id), extra_id uuid not null references public.service_extras(id), name_snapshot text not null,
  unit_price_minor bigint not null, quantity integer not null check(quantity>0), total_minor bigint not null check(total_minor>=0), primary key(booking_id,extra_id)
);
create table public.booking_location_samples (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id), seller_id uuid not null references public.seller_profiles(user_id),
  captured_at timestamptz not null default now(), coarse_geohash text, accuracy_band text, consent_id uuid references public.consents(id), purge_at timestamptz not null, created_at timestamptz not null default now()
);
create table public.booking_media (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id), uploader_id uuid not null references public.profiles(id),
  media_type text not null, storage_path text not null unique, purpose text not null, consent_id uuid references public.consents(id), moderation_status public.moderation_status not null default 'pending',
  retain_until timestamptz, created_at timestamptz not null default now()
);
create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(), request_id uuid references public.booking_requests(id), buyer_id uuid not null references public.profiles(id),
  service_id uuid not null references public.services(id), service_area_id uuid not null references public.service_areas(id), starts_at timestamptz, ends_at timestamptz,
  maximum_minor bigint, status text not null default 'active', priority integer not null default 0, expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cancellations (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references public.bookings(id), actor_id uuid not null references public.profiles(id),
  reason_code text not null, policy_snapshot jsonb not null, fee_minor bigint not null default 0, refund_minor bigint not null default 0,
  waived_by uuid references public.profiles(id), waiver_reason text, created_at timestamptz not null default now()
);

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(), template_key text not null, channel public.notification_channel not null, locale text not null default 'en-BS', version integer not null,
  subject text, title text, body text not null, required_variables text[] not null default '{}', active boolean not null default true, approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), unique(template_key,channel,locale,version)
);
create table public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid references public.profiles(id), endpoint_url text not null, signing_secret_ref text not null,
  event_types text[] not null, status text not null default 'active', rate_limit_per_minute integer not null default 60, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.webhook_subscriptions(id), event_id uuid not null references public.domain_events(id),
  attempt integer not null default 0, signature_metadata jsonb not null default '{}', response_code integer, next_attempt_at timestamptz,
  status public.delivery_status not null default 'queued', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.payment_customers (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), processor text not null, external_customer_ref text not null,
  created_at timestamptz not null default now(), unique(user_id,processor), unique(processor,external_customer_ref)
);
create table public.payment_events (
  id uuid primary key default gen_random_uuid(), processor text not null, external_event_id text not null, event_type text not null,
  payload_redacted jsonb not null default '{}', signature_verified boolean not null, received_at timestamptz not null default now(), processed_at timestamptz,
  processing_error text, unique(processor,external_event_id)
);
create table public.financial_disputes (
  id uuid primary key default gen_random_uuid(), payment_intent_id uuid not null references public.payment_intents(id), processor_case_ref text,
  amount_minor bigint not null, currency char(3) not null default 'BSD', status text not null default 'open', evidence_due_at timestamptz,
  outcome text, opened_at timestamptz not null default now(), resolved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.payout_items (
  payout_id uuid not null references public.payouts(id), booking_id uuid not null references public.bookings(id), ledger_transaction_id uuid references public.ledger_transactions(id),
  gross_minor bigint not null, fee_minor bigint not null, adjustment_minor bigint not null default 0, net_minor bigint not null, primary key(payout_id,booking_id)
);
create table public.invoices_receipts (
  id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id), party_id uuid not null references public.profiles(id),
  document_type text not null check(document_type in('receipt','invoice','statement')), document_number text not null unique, totals_snapshot jsonb not null,
  storage_path text, issued_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(), processor text not null, period_start timestamptz not null, period_end timestamptz not null,
  status text not null default 'running', totals jsonb not null default '{}', differences jsonb not null default '{}', report_path text,
  actor_id uuid references public.profiles(id), completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.review_dimension_definitions (
  id uuid primary key default gen_random_uuid(), service_id uuid references public.services(id), dimension_key text not null, label text not null,
  description text, version integer not null default 1, active boolean not null default true, created_at timestamptz not null default now(), unique(service_id,dimension_key,version)
);
create table public.review_dimension_scores (
  review_id uuid not null references public.reviews(id) on delete cascade, dimension_id uuid not null references public.review_dimension_definitions(id), score smallint not null check(score between 1 and 5), primary key(review_id,dimension_id)
);
create table public.review_revisions (
  id uuid primary key default gen_random_uuid(), review_id uuid not null references public.reviews(id), prior_body text, prior_scores jsonb,
  changed_by uuid not null references public.profiles(id), reason text not null, created_at timestamptz not null default now()
);
create table public.review_responses (
  id uuid primary key default gen_random_uuid(), review_id uuid not null unique references public.reviews(id), author_id uuid not null references public.profiles(id),
  body text not null check(char_length(body) between 1 and 1500), moderation_status public.moderation_status not null default 'allowed', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.review_reports (
  id uuid primary key default gen_random_uuid(), review_id uuid not null references public.reviews(id), reporter_id uuid not null references public.profiles(id),
  reason_code text not null, details text, status public.case_status not null default 'open', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(review_id,reporter_id)
);
create table public.rating_aggregates (
  subject_user_id uuid not null references public.profiles(id), service_id uuid references public.services(id), rating_sum bigint not null default 0,
  rating_count integer not null default 0, bayesian_score numeric(5,3) not null default 0, updated_at timestamptz not null default now(), unique nulls not distinct(subject_user_id,service_id)
);
create table public.badge_requirements (
  id uuid primary key default gen_random_uuid(), badge_id uuid not null references public.badges(id), requirement_type text not null,
  metric_key text not null, operator text not null check(operator in('eq','gte','lte','exists')), threshold numeric, window_days integer, created_at timestamptz not null default now()
);

create table public.case_evidence (
  id uuid primary key default gen_random_uuid(), dispute_id uuid not null references public.service_disputes(id), uploader_id uuid not null references public.profiles(id),
  storage_path text not null unique, evidence_type text not null, checksum text, scan_status text not null default 'pending', retain_until timestamptz,
  legal_hold boolean not null default false, created_at timestamptz not null default now()
);
create table public.case_events (
  id uuid primary key default gen_random_uuid(), dispute_id uuid not null references public.service_disputes(id), actor_id uuid references public.profiles(id),
  event_type text not null, note_redacted text, metadata_redacted jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.safety_incidents (
  id uuid primary key default gen_random_uuid(), booking_id uuid references public.bookings(id), reporter_id uuid not null references public.profiles(id),
  category text not null, severity public.case_priority not null default 'high', status public.case_status not null default 'open', assigned_admin_id uuid references public.profiles(id),
  acknowledged_at timestamptz, resolved_at timestamptz, emergency_contact_outcome text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.risk_signals (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id), booking_id uuid references public.bookings(id), payment_intent_id uuid references public.payment_intents(id),
  review_id uuid references public.reviews(id), signal_type text not null, source text not null, score numeric(6,3) not null, evidence_redacted jsonb not null default '{}',
  status text not null default 'new', reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.idempotency_keys (
  key text not null, actor_id uuid not null references public.profiles(id), scope text not null, request_hash text not null, status text not null default 'processing',
  response_code integer, response_body_redacted jsonb, locked_at timestamptz not null default now(), expires_at timestamptz not null, created_at timestamptz not null default now(), primary key(actor_id,scope,key)
);
create table public.scheduled_workers (
  key text primary key, schedule text not null, enabled boolean not null default true, last_run_at timestamptz, next_run_at timestamptz,
  locked_until timestamptz, health_status text not null default 'unknown', updated_at timestamptz not null default now()
);
create table public.worker_runs (
  id uuid primary key default gen_random_uuid(), worker_key text not null references public.scheduled_workers(key), started_at timestamptz not null default now(),
  ended_at timestamptz, status text not null default 'running', processed_count integer not null default 0, cursor jsonb, error_summary text, trace_id uuid not null default gen_random_uuid()
);
create table public.dead_letters (
  id uuid primary key default gen_random_uuid(), source_queue text not null, message_ref uuid, attempts integer not null, last_error text not null,
  payload_redacted jsonb not null default '{}', replayed_by uuid references public.profiles(id), replayed_at timestamptz, created_at timestamptz not null default now()
);
create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.seller_profiles(user_id), vendor text not null,
  encrypted_token_ref text not null, scopes text[] not null default '{}', status text not null default 'active', sync_cursor text, last_sync_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.calendar_busy_blocks (
  id uuid primary key default gen_random_uuid(), connection_id uuid not null references public.calendar_connections(id), external_event_hash text not null,
  starts_at timestamptz not null, ends_at timestamptz not null, status text not null default 'busy', created_at timestamptz not null default now(), unique(connection_id,external_event_hash), check(ends_at>starts_at)
);
create table public.integration_accounts (
  id uuid primary key default gen_random_uuid(), integration_type text not null, vendor text not null, external_org_ref text, status text not null default 'inactive',
  config_secret_refs jsonb not null default '{}', health jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(integration_type,vendor)
);
create table public.analytics_daily (
  metric_date date not null, service_id uuid references public.services(id), service_area_id uuid references public.service_areas(id),
  metric_key text not null, metric_count bigint not null default 0, metric_sum_minor bigint, currency char(3), created_at timestamptz not null default now(), unique nulls not distinct(metric_date,service_id,service_area_id,metric_key)
);

create index favorites_seller on public.favorites(seller_id);
create index requests_market_queue on public.booking_requests(service_area_id,service_id,status,desired_start) where status in('requested','offered');
create index quotes_buyer_time on public.booking_quotes(buyer_id,created_at desc);
create index verification_queue on public.verification_cases(status,initiated_at) where status in('pending','needs_information');
create index disputes_admin_queue on public.service_disputes(status,priority,created_at) where status not in('resolved','closed');
create index risk_review_queue on public.risk_signals(status,score desc,created_at) where status in('new','reviewing');
create index location_purge_queue on public.booking_location_samples(purge_at) where purge_at is not null;

create or replace function app_private.create_care_request(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid()); v_request uuid := gen_random_uuid(); v_member uuid; v_address uuid; v_service uuid; v_area uuid;
  v_start timestamptz; v_end timestamptz; v_mode public.booking_mode; v_summary text; v_budget bigint;
begin
  if v_user is null or not app_private.has_role('buyer') then raise exception 'buyer_required'; end if;
  v_member := nullif(p_payload->>'household_member_id','')::uuid;
  v_address := nullif(p_payload->>'address_id','')::uuid;
  v_service := (p_payload->>'service_id')::uuid; v_area := (p_payload->>'service_area_id')::uuid;
  v_start := (p_payload->>'desired_start')::timestamptz; v_end := (p_payload->>'desired_end')::timestamptz;
  v_mode := coalesce((p_payload->>'mode')::public.booking_mode,'scheduled'); v_summary := trim(p_payload->>'care_summary');
  v_budget := nullif(p_payload->>'budget_minor','')::bigint;
  if v_end<=v_start or v_start<now()-interval '5 minutes' or char_length(v_summary) not between 10 and 1200 then raise exception 'invalid_request'; end if;
  if v_address is not null and not exists(select 1 from public.addresses where id=v_address and owner_user_id=v_user and deleted_at is null) then raise exception 'invalid_address'; end if;
  if v_member is not null and not exists(select 1 from public.household_members hm join public.households h on h.id=hm.household_id where hm.id=v_member and h.owner_user_id=v_user) then raise exception 'invalid_care_recipient'; end if;
  if not exists(select 1 from public.services s join public.service_areas a on a.id=v_area where s.id=v_service and s.active and a.active) then raise exception 'service_unavailable'; end if;
  insert into public.booking_requests(id,buyer_id,household_member_id,address_id,service_id,service_area_id,mode,desired_start,desired_end,care_summary,budget_minor,expires_at)
  values(v_request,v_user,v_member,v_address,v_service,v_area,v_mode,v_start,v_end,v_summary,v_budget,now()+interval '7 days');
  insert into public.booking_request_private(request_id,buyer_id,care_requirements_private,access_notes_private)
  values(v_request,v_user,coalesce(p_payload->'care_requirements','{}'::jsonb),left(p_payload->>'access_notes',1000));
  insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted) values('booking_request',v_request,'care_request.created',jsonb_build_object('service_id',v_service,'service_area_id',v_area));
  return jsonb_build_object('ok',true,'request_id',v_request,'status','requested');
exception when invalid_text_representation then raise exception 'invalid_identifier_or_date';
end; $$;
create or replace function public.create_care_request(p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select app_private.create_care_request(p_payload); $$;

create or replace function app_private.bootstrap_admin(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
  if current_user not in ('service_role','postgres') then raise exception 'service_role_required'; end if;
  insert into public.user_roles(user_id,role,granted_by) values(p_user_id,'admin',p_user_id) on conflict do nothing;
  insert into public.admin_permissions(admin_user_id,permission_key,granted_by) values
  (p_user_id,'*',p_user_id) on conflict do nothing;
  return jsonb_build_object('ok',true,'admin_user_id',p_user_id);
end; $$;

do $$ declare r record; begin for r in select tablename from pg_tables where schemaname='public' and rowsecurity=false loop execute format('alter table public.%I enable row level security',r.tablename); end loop; end $$;

create policy legal_documents_public on public.legal_documents for select to anon,authenticated using(active or app_private.has_admin_permission('config.manage'));
create policy consents_owner_admin on public.consents for select to authenticated using(user_id=(select auth.uid()) or app_private.has_admin_permission('privacy.manage'));
create policy consents_owner_insert on public.consents for insert to authenticated with check(user_id=(select auth.uid()));
create policy privacy_owner_admin on public.privacy_requests for select to authenticated using(user_id=(select auth.uid()) or app_private.has_admin_permission('privacy.manage'));
create policy privacy_owner_insert on public.privacy_requests for insert to authenticated with check(user_id=(select auth.uid()));
create policy devices_owner on public.devices for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy blocks_owner on public.blocks for all to authenticated using(blocker_user_id=(select auth.uid())) with check(blocker_user_id=(select auth.uid()));
create policy catalog_extended_public on public.service_extras for select to anon,authenticated using(active or app_private.has_admin_permission('catalog.manage'));
create policy cancellation_public on public.cancellation_policies for select to anon,authenticated using(active or app_private.has_admin_permission('catalog.manage'));
create policy promotions_authenticated on public.promotion_codes for select to authenticated using(status='active' or app_private.has_admin_permission('promotions.manage'));
create policy seller_extended_owner_portfolio on public.seller_portfolio_assets for all to authenticated using(seller_id=(select auth.uid()) or app_private.has_admin_permission('sellers.read')) with check(seller_id=(select auth.uid()));
create policy seller_extended_owner_languages on public.seller_languages for all to authenticated using(seller_id=(select auth.uid()) or app_private.has_admin_permission('sellers.read')) with check(seller_id=(select auth.uid()));
create policy seller_extended_owner_rules on public.seller_offer_rules for all to authenticated using(seller_id=(select auth.uid())) with check(seller_id=(select auth.uid()));
create policy background_owner_admin on public.background_checks for select to authenticated using(seller_id=(select auth.uid()) or app_private.has_admin_permission('kyc.review'));
create policy payout_accounts_owner_admin on public.payout_accounts for all to authenticated using(seller_id=(select auth.uid()) or app_private.has_admin_permission('finance.read')) with check(seller_id=(select auth.uid()));
create policy favorites_owner on public.favorites for all to authenticated using(buyer_id=(select auth.uid())) with check(buyer_id=(select auth.uid()));
create policy saved_search_owner on public.saved_searches for all to authenticated using(buyer_id=(select auth.uid())) with check(buyer_id=(select auth.uid()));
create policy match_owner_admin on public.match_runs for select to authenticated using(buyer_id=(select auth.uid()) or app_private.has_admin_permission('bookings.read'));
create policy booking_extended_parties on public.booking_extras for select to authenticated using(app_private.is_booking_party(booking_id) or app_private.has_admin_permission('bookings.read'));
create policy location_parties_admin on public.booking_location_samples for select to authenticated using(app_private.is_booking_party(booking_id) or app_private.has_admin_permission('safety.read'));
create policy media_parties_admin on public.booking_media for select to authenticated using(app_private.is_booking_party(booking_id) or app_private.has_admin_permission('safety.read'));
create policy waitlist_owner_admin on public.waitlist_entries for all to authenticated using(buyer_id=(select auth.uid()) or app_private.has_admin_permission('bookings.manage')) with check(buyer_id=(select auth.uid()));
create policy cancellations_parties_admin on public.cancellations for select to authenticated using(app_private.is_booking_party(booking_id) or app_private.has_admin_permission('bookings.read'));
create policy payment_customers_owner on public.payment_customers for select to authenticated using(user_id=(select auth.uid()) or app_private.has_admin_permission('finance.read'));
create policy financial_admin on public.payment_events for select to authenticated using(app_private.has_admin_permission('finance.read'));
create policy financial_disputes_admin on public.financial_disputes for select to authenticated using(app_private.has_admin_permission('finance.read'));
create policy receipts_party_admin on public.invoices_receipts for select to authenticated using(party_id=(select auth.uid()) or app_private.has_admin_permission('finance.read'));
create policy reviews_extended_public_dimensions on public.review_dimension_definitions for select to anon,authenticated using(active or app_private.has_admin_permission('reviews.manage'));
create policy review_scores_public on public.review_dimension_scores for select to anon,authenticated using(exists(select 1 from public.reviews r where r.id=review_id and (r.status='published' or r.author_id=(select auth.uid()) or r.subject_id=(select auth.uid()))));
create policy review_response_public on public.review_responses for select to anon,authenticated using(moderation_status='allowed' or author_id=(select auth.uid()) or app_private.has_admin_permission('moderation.read'));
create policy review_reports_owner_admin on public.review_reports for select to authenticated using(reporter_id=(select auth.uid()) or app_private.has_admin_permission('moderation.read'));
create policy cases_parties_evidence on public.case_evidence for select to authenticated using(exists(select 1 from public.service_disputes d where d.id=dispute_id and (app_private.is_booking_party(d.booking_id) or app_private.has_admin_permission('disputes.manage'))));
create policy safety_reporter_admin on public.safety_incidents for select to authenticated using(reporter_id=(select auth.uid()) or app_private.has_admin_permission('safety.read'));
create policy safety_reporter_insert on public.safety_incidents for insert to authenticated with check(reporter_id=(select auth.uid()));
create policy admin_only_risk on public.risk_signals for select to authenticated using(app_private.has_admin_permission('risk.read'));
create policy calendar_owner on public.calendar_connections for all to authenticated using(seller_id=(select auth.uid())) with check(seller_id=(select auth.uid()));
create policy worker_admin on public.scheduled_workers for select to authenticated using(app_private.has_admin_permission('workers.read'));
create policy analytics_admin on public.analytics_daily for select to authenticated using(app_private.has_admin_permission('analytics.read'));

revoke all on all tables in schema public from anon,authenticated;
grant select on public.islands,public.service_areas,public.service_categories,public.services,public.service_extras,public.cancellation_policies,public.seller_profiles,public.seller_services,public.seller_service_areas,public.availability_rules,public.seller_credentials,public.reviews,public.review_dimension_definitions,public.review_dimension_scores,public.review_responses,public.badges,public.user_badges,public.legal_documents to anon;
grant select on all tables in schema public to authenticated;
grant insert,update,delete on public.consents,public.privacy_requests,public.devices,public.blocks,public.seller_languages,public.seller_portfolio_assets,public.seller_offer_rules,public.payout_accounts,public.favorites,public.saved_searches,public.waitlist_entries,public.review_responses,public.review_reports,public.safety_incidents,public.calendar_connections to authenticated;
grant execute on function app_private.create_care_request(jsonb) to authenticated;
grant execute on function public.create_care_request(jsonb) to authenticated;
revoke execute on function app_private.bootstrap_admin(uuid) from public,anon,authenticated;
grant execute on function app_private.bootstrap_admin(uuid) to service_role;

create or replace view public.admin_overview with(security_invoker=true) as
select
  (select count(*) from public.profiles where account_status='active') active_users,
  (select count(*) from public.seller_profiles where status='under_review') sellers_under_review,
  (select count(*) from public.booking_requests where status in('requested','offered')) open_care_requests,
  (select count(*) from public.bookings where status in('confirmed','in_progress','completion_pending')) active_bookings,
  (select count(*) from public.service_disputes where status not in('resolved','closed')) open_disputes,
  (select count(*) from public.moderation_reports where status not in('resolved','closed')) moderation_queue,
  (select coalesce(sum(amount_minor),0) from public.payment_intents where status='captured') simulated_volume_minor;
grant select on public.admin_overview to authenticated;

commit;
