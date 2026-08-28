begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists postgis with schema extensions;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

create type public.app_role as enum ('buyer', 'seller', 'admin');
create type public.account_status as enum ('pending', 'active', 'restricted', 'suspended', 'closed');
create type public.seller_status as enum ('draft', 'submitted', 'needs_information', 'under_review', 'approved', 'rejected', 'paused', 'suspended');
create type public.verification_status as enum ('not_started', 'pending', 'needs_information', 'approved', 'rejected', 'expired', 'revoked');
create type public.booking_mode as enum ('scheduled', 'on_demand');
create type public.booking_status as enum ('draft', 'quoted', 'payment_pending', 'requested', 'offered', 'confirmed', 'in_progress', 'completion_pending', 'completed', 'cancelled', 'expired', 'disputed', 'resolved');
create type public.offer_status as enum ('queued', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'withdrawn');
create type public.payment_status as enum ('requires_method', 'requires_action', 'authorized', 'captured', 'partially_refunded', 'refunded', 'failed', 'cancelled', 'disputed');
create type public.payout_status as enum ('pending', 'scheduled', 'processing', 'paid', 'failed', 'reversed', 'held');
create type public.review_status as enum ('pending_peer', 'published', 'hidden', 'removed');
create type public.notification_channel as enum ('in_app', 'push', 'email', 'sms');
create type public.delivery_status as enum ('queued', 'processing', 'delivered', 'failed', 'suppressed', 'dead_letter');
create type public.case_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.case_status as enum ('open', 'awaiting_user', 'awaiting_admin', 'escalated', 'resolved', 'closed');
create type public.moderation_status as enum ('pending', 'allowed', 'limited', 'removed');
create type public.ledger_direction as enum ('debit', 'credit');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Nanas member' check (char_length(display_name) between 2 and 80),
  first_name_private text check (char_length(first_name_private) <= 80),
  last_name_private text check (char_length(last_name_private) <= 80),
  avatar_path text,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  locale text not null default 'en-BS',
  timezone text not null default 'America/Nassau',
  account_status public.account_status not null default 'active',
  date_of_birth_private date,
  last_active_at timestamptz,
  suspended_reason text,
  suspended_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index user_roles_active_unique on public.user_roles(user_id, role) where revoked_at is null;

create table public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null check (permission_key ~ '^[a-z][a-z0-9_.-]{2,80}$'),
  conditions jsonb not null default '{}'::jsonb,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index admin_permissions_active_unique on public.admin_permissions(admin_user_id, permission_key) where revoked_at is null;

create table public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  locale text not null default 'en-BS',
  timezone text not null default 'America/Nassau',
  distance_unit text not null default 'km' check (distance_unit in ('km','mi')),
  reduced_motion boolean not null default false,
  high_contrast boolean not null default false,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_category text not null,
  in_app boolean not null default true,
  push boolean not null default true,
  email boolean not null default true,
  sms boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text not null default 'America/Nassau',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, event_category)
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  relationship text not null check (char_length(relationship) <= 40),
  display_name text not null check (char_length(display_name) between 1 and 80),
  date_of_birth_private date,
  care_notes_private text check (char_length(care_notes_private) <= 4000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.islands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country_code char(2) not null default 'BS' check (country_code = 'BS'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  island_id uuid not null references public.islands(id),
  name text not null,
  slug text not null,
  boundary extensions.geography(multipolygon,4326),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (island_id, slug)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(label) <= 50),
  line1_private text not null,
  line2_private text,
  locality text not null,
  island_id uuid not null references public.islands(id),
  postal_code text,
  country_code char(2) not null default 'BS' check (country_code = 'BS'),
  geog extensions.geography(point,4326),
  access_notes_private text check (char_length(access_notes_private) <= 1000),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index addresses_one_default on public.addresses(owner_user_id) where is_default and deleted_at is null;

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  phone_e164 text not null check (phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  relationship text not null,
  consent_confirmed_at timestamptz,
  priority smallint not null default 1 check (priority between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null,
  icon_key text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id),
  name text not null,
  slug text not null unique,
  description text not null,
  pricing_unit text not null check (pricing_unit in ('hour','visit','day','fixed')),
  minimum_duration_minutes integer not null default 60 check (minimum_duration_minutes > 0),
  booking_increment_minutes integer not null default 30 check (booking_increment_minutes > 0),
  minimum_lead_minutes integer not null default 120 check (minimum_lead_minutes >= 0),
  maximum_advance_days integer not null default 90 check (maximum_advance_days between 1 and 365),
  booking_modes public.booking_mode[] not null default array['scheduled']::public.booking_mode[],
  location_modes text[] not null default array['buyer_home']::text[],
  requirements_schema jsonb not null default '{}'::jsonb,
  required_credential_types text[] not null default '{}'::text[],
  risk_level text not null default 'standard' check (risk_level in ('standard','elevated','clinical')),
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seller_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status public.seller_status not null default 'draft',
  public_slug text unique,
  display_name text not null,
  headline text check (char_length(headline) <= 120),
  bio text check (char_length(bio) <= 2000),
  years_experience integer not null default 0 check (years_experience between 0 and 80),
  languages text[] not null default array['en-BS']::text[],
  avatar_path text,
  island_id uuid references public.islands(id),
  locality text,
  approved_at timestamptz,
  profile_published_at timestamptz,
  pause_reason text,
  rating_average numeric(3,2) not null default 0 check (rating_average between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  completed_bookings integer not null default 0 check (completed_bookings >= 0),
  response_rate numeric(5,2) not null default 0 check (response_rate between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seller_services (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(user_id) on delete cascade,
  service_id uuid not null references public.services(id),
  rate_minor bigint not null check (rate_minor >= 0),
  currency char(3) not null default 'BSD' check (currency ~ '^[A-Z]{3}$'),
  minimum_duration_minutes integer not null default 60 check (minimum_duration_minutes > 0),
  maximum_duration_minutes integer check (maximum_duration_minutes is null or maximum_duration_minutes >= minimum_duration_minutes),
  booking_modes public.booking_mode[] not null default array['scheduled']::public.booking_mode[],
  experience_summary text check (char_length(experience_summary) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, service_id)
);

create table public.seller_service_areas (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(user_id) on delete cascade,
  service_area_id uuid not null references public.service_areas(id),
  radius_km numeric(6,2) check (radius_km is null or radius_km between 0 and 500),
  travel_fee_minor bigint not null default 0 check (travel_fee_minor >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, service_area_id)
);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(user_id) on delete cascade,
  timezone text not null default 'America/Nassau',
  weekday smallint not null check (weekday between 0 and 6),
  local_start time not null,
  local_end time not null,
  valid_from date,
  valid_until date,
  service_id uuid references public.services(id),
  service_area_id uuid references public.service_areas(id),
  capacity smallint not null default 1 check (capacity between 1 and 10),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (local_end > local_start),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(user_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  available boolean not null,
  reason text,
  service_id uuid references public.services(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.seller_documents (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(user_id) on delete cascade,
  document_type text not null,
  storage_path text not null unique,
  file_hash text,
  issue_date date,
  expiry_date date,
  status public.verification_status not null default 'pending',
  metadata_redacted jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.verification_cases (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(user_id) on delete cascade,
  verification_type text not null,
  vendor text not null default 'manual',
  external_ref text,
  status public.verification_status not null default 'pending',
  initiated_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz,
  decision_reason text,
  admin_reviewer_id uuid references public.profiles(id),
  result_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seller_credentials (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(user_id) on delete cascade,
  service_id uuid references public.services(id),
  credential_type text not null,
  issuing_body text,
  identifier_redacted text,
  issue_date date,
  expiry_date date,
  status public.verification_status not null default 'pending',
  source_document_id uuid references public.seller_documents(id),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id),
  household_member_id uuid references public.household_members(id),
  address_id uuid references public.addresses(id),
  service_id uuid not null references public.services(id),
  service_area_id uuid not null references public.service_areas(id),
  mode public.booking_mode not null default 'scheduled',
  desired_start timestamptz not null,
  desired_end timestamptz not null,
  timezone text not null default 'America/Nassau',
  care_summary text not null check (char_length(care_summary) between 10 and 1200),
  budget_minor bigint check (budget_minor is null or budget_minor >= 0),
  currency char(3) not null default 'BSD' check (currency ~ '^[A-Z]{3}$'),
  status public.booking_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  check (desired_end > desired_start)
);

create table public.booking_request_private (
  request_id uuid primary key references public.booking_requests(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id),
  care_requirements_private jsonb not null default '{}'::jsonb,
  access_notes_private text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.booking_requests(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.seller_profiles(user_id),
  service_id uuid not null references public.services(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  base_minor bigint not null check (base_minor >= 0),
  travel_minor bigint not null default 0 check (travel_minor >= 0),
  platform_fee_minor bigint not null default 0 check (platform_fee_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint generated always as (base_minor + travel_minor + platform_fee_minor + tax_minor) stored,
  currency char(3) not null default 'BSD' check (currency ~ '^[A-Z]{3}$'),
  policy_snapshot jsonb not null default '{}'::jsonb,
  quote_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('NAN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  buyer_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.seller_profiles(user_id),
  request_id uuid references public.booking_requests(id),
  quote_id uuid references public.booking_quotes(id),
  service_id uuid not null references public.services(id),
  address_id uuid references public.addresses(id),
  household_member_id uuid references public.household_members(id),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  scheduled_range tstzrange generated always as (tstzrange(scheduled_start, scheduled_end, '[)')) stored,
  timezone text not null default 'America/Nassau',
  status public.booking_status not null default 'confirmed',
  blocks_calendar boolean not null default true,
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  platform_fee_minor bigint not null default 0 check (platform_fee_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  seller_net_minor bigint not null check (seller_net_minor >= 0),
  currency char(3) not null default 'BSD' check (currency ~ '^[A-Z]{3}$'),
  price_snapshot jsonb not null default '{}'::jsonb,
  cancellation_policy_snapshot jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  confirmed_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end > scheduled_start),
  check (seller_net_minor <= total_minor),
  check (blocks_calendar = (status in ('confirmed','in_progress','completion_pending')))
);
alter table public.bookings add constraint bookings_no_seller_overlap exclude using gist (seller_id with =, scheduled_range with &&) where (blocks_calendar);

create table public.booking_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.booking_requests(id) on delete cascade,
  quote_id uuid references public.booking_quotes(id),
  booking_id uuid references public.bookings(id),
  seller_id uuid not null references public.seller_profiles(user_id),
  status public.offer_status not null default 'sent',
  rank integer not null default 1,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'BSD',
  message text check (char_length(message) <= 1200),
  sent_at timestamptz not null default now(),
  viewed_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz not null,
  decline_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index booking_offers_active_seller_request on public.booking_offers(request_id, seller_id) where status in ('queued','sent','viewed','accepted');

create table public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  actor_id uuid references public.profiles(id),
  reason_code text,
  note text,
  source text not null default 'app',
  idempotency_key text,
  created_at timestamptz not null default now()
);

create table public.booking_participants (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null check (role in ('buyer','seller')),
  access_starts_at timestamptz not null default now(),
  access_ends_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (booking_id, user_id)
);

create table public.booking_session_codes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  code_digest text not null,
  attempt_count integer not null default 0,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  buyer_verified_at timestamptz,
  seller_verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (valid_until > valid_from)
);

create table public.booking_checkins (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  event_type text not null check (event_type in ('check_in','check_out')),
  occurred_at timestamptz not null default now(),
  method text not null default 'session_code',
  code_verified boolean not null default false,
  geofence_outcome text,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null check (conversation_type in ('booking','request','support','case')),
  booking_id uuid references public.bookings(id),
  request_id uuid references public.booking_requests(id),
  status text not null default 'active' check (status in ('active','closed','archived')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  muted boolean not null default false,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  message_type text not null default 'text' check (message_type in ('text','image','file','system')),
  body text not null check (char_length(body) between 1 and 4000),
  reply_to_id uuid references public.messages(id),
  moderation_status public.moderation_status not null default 'allowed',
  sender_nonce text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  unique (sender_id, sender_nonce)
);
create index messages_conversation_order on public.messages(conversation_id, created_at desc, id desc);

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  checksum text,
  scan_status text not null default 'pending' check (scan_status in ('pending','clean','quarantined','failed')),
  moderation_status public.moderation_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  processor text not null default 'simulation',
  external_ref text not null,
  method_type text not null default 'card',
  brand text,
  last4 char(4),
  expiry_display text,
  is_default boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (processor, external_ref)
);
create unique index payment_methods_one_default on public.payment_methods(user_id) where is_default and status = 'active';

create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id),
  request_id uuid references public.booking_requests(id),
  payer_id uuid not null references public.profiles(id),
  processor text not null default 'simulation',
  external_ref text,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null default 'BSD',
  status public.payment_status not null default 'requires_method',
  idempotency_key text not null,
  captured_minor bigint not null default 0 check (captured_minor >= 0),
  refunded_minor bigint not null default 0 check (refunded_minor >= 0),
  authorized_at timestamptz,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payer_id, idempotency_key),
  check (captured_minor <= amount_minor),
  check (refunded_minor <= captured_minor)
);

create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  account_type text not null check (account_type in ('buyer_wallet','seller_wallet','processor_clearing','protected_funds','platform_revenue','refund_payable')),
  owner_user_id uuid references public.profiles(id),
  currency char(3) not null default 'BSD',
  status text not null default 'active' check (status in ('active','held','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (account_type, owner_user_id, currency)
);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  reference_type text not null,
  reference_id uuid,
  event_type text not null,
  currency char(3) not null default 'BSD',
  description text not null,
  idempotency_key text not null unique,
  posted_at timestamptz not null default now(),
  reversed_transaction_id uuid references public.ledger_transactions(id),
  created_at timestamptz not null default now()
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions(id),
  account_id uuid not null references public.ledger_accounts(id),
  direction public.ledger_direction not null,
  amount_minor bigint not null check (amount_minor > 0),
  booking_id uuid references public.bookings(id),
  buyer_id uuid references public.profiles(id),
  seller_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index ledger_entries_account_time on public.ledger_entries(account_id, created_at desc);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  payment_intent_id uuid not null references public.payment_intents(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'BSD',
  reason text not null,
  status public.payment_status not null default 'requires_action',
  requested_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(user_id),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'BSD',
  status public.payout_status not null default 'pending',
  processor text not null default 'simulation',
  external_ref text,
  period_start date,
  period_end date,
  scheduled_at timestamptz,
  paid_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  author_id uuid not null references public.profiles(id),
  subject_id uuid not null references public.profiles(id),
  subject_role public.app_role not null check (subject_role in ('buyer','seller')),
  overall_rating smallint not null check (overall_rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  status public.review_status not null default 'pending_peer',
  submitted_at timestamptz not null default now(),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, author_id, subject_id),
  check (author_id <> subject_id)
);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  icon_key text not null,
  issuer_type text not null check (issuer_type in ('verification','credential','earned','admin')),
  criteria_public text,
  rule_version integer not null default 1,
  rule_config jsonb not null default '{}'::jsonb,
  validity_days integer,
  active boolean not null default true,
  public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id),
  source_type text not null,
  source_id uuid,
  awarded_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  rule_version integer not null,
  metric_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index user_badges_active_source on public.user_badges(user_id, badge_id, source_type, source_id) where revoked_at is null;

create table public.service_disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  opened_by uuid not null references public.profiles(id),
  reason_code text not null,
  summary text not null check (char_length(summary) between 10 and 3000),
  priority public.case_priority not null default 'normal',
  status public.case_status not null default 'open',
  assigned_admin_id uuid references public.profiles(id),
  resolution_code text,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index service_disputes_one_active on public.service_disputes(booking_id) where status not in ('resolved','closed');

create table public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  target_type text not null check (target_type in ('profile','message','review','booking','document')),
  target_id uuid not null,
  reason_code text not null,
  details text check (char_length(details) <= 3000),
  priority public.case_priority not null default 'normal',
  status public.case_status not null default 'open',
  assigned_admin_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.domain_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id uuid,
  event_type text not null,
  event_version integer not null default 1,
  payload_redacted jsonb not null default '{}'::jsonb,
  trace_id uuid not null default gen_random_uuid(),
  occurred_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  category text not null,
  title text not null,
  body text not null,
  deep_link text,
  related_type text,
  related_id uuid,
  read_at timestamptz,
  archived_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_unread on public.notifications(recipient_id, created_at desc) where read_at is null and archived_at is null;

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  domain_event_id uuid references public.domain_events(id),
  recipient_id uuid not null references public.profiles(id),
  template_key text not null,
  category text not null,
  priority public.case_priority not null default 'normal',
  variables_redacted jsonb not null default '{}'::jsonb,
  available_at timestamptz not null default now(),
  dedupe_key text not null unique,
  status public.delivery_status not null default 'queued',
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notification_outbox_ready on public.notification_outbox(status, available_at) where status in ('queued','failed');

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.notification_outbox(id),
  notification_id uuid references public.notifications(id),
  channel public.notification_channel not null,
  destination_hash text,
  vendor text not null default 'local-simulation',
  external_id text,
  status public.delivery_status not null default 'queued',
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  before_redacted jsonb,
  after_redacted jsonb,
  reason text not null,
  trace_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.admin_access_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id),
  resource_type text not null,
  resource_id uuid,
  purpose_code text not null,
  case_id uuid,
  fields_accessed text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create table public.feature_flags (
  key text primary key,
  description text not null,
  enabled boolean not null default false,
  targeting_rules jsonb not null default '{}'::jsonb,
  rollout_percent smallint not null default 0 check (rollout_percent between 0 and 100),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.system_settings (
  key text primary key,
  version integer not null default 1,
  value jsonb not null,
  effective_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

commit;
