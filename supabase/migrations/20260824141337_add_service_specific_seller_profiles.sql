-- Care-style seller profiles: public identity is global, while biography,
-- experience, rate range and capabilities are specific to each care service.

alter table public.seller_profiles
  add column vaccinations text[] not null default '{}'::text[],
  add column additional_details text[] not null default '{}'::text[];

alter table public.seller_services
  add column service_bio text,
  add column years_experience integer not null default 0,
  add column rate_max_minor bigint,
  add column capabilities text[] not null default '{}'::text[],
  add column additional_help text[] not null default '{}'::text[];

-- Preserve all useful legacy copy before removing the single global biography
-- and the old ambiguous service summary field.
update public.seller_services ss
set service_bio = coalesce(
      nullif(trim(ss.experience_summary), ''),
      nullif(trim(sp.bio), '')
    ),
    years_experience = sp.years_experience
from public.seller_profiles sp
where sp.user_id = ss.seller_id;

drop view if exists public.seller_directory;

drop function if exists public.seller_upsert_service(uuid,bigint,text,boolean);
drop function if exists app_private.seller_upsert_service(uuid,bigint,text,boolean);
drop function if exists public.seller_update_public_profile(text,text,text,text,integer,text[],uuid,text);
drop function if exists app_private.seller_update_public_profile(text,text,text,text,integer,text[],uuid,text);

alter table public.seller_services drop column experience_summary;
alter table public.seller_profiles drop column bio;
alter table public.seller_profiles drop column years_experience;

alter table public.seller_services
  add constraint seller_services_service_bio_length_check
    check (service_bio is null or char_length(service_bio) between 1 and 2000),
  add constraint seller_services_years_experience_check
    check (years_experience between 0 and 80),
  add constraint seller_services_rate_max_check
    check (rate_max_minor is null or rate_max_minor >= rate_minor),
  add constraint seller_services_capabilities_count_check
    check (cardinality(capabilities) <= 30),
  add constraint seller_services_additional_help_count_check
    check (cardinality(additional_help) <= 20);

alter table public.seller_profiles
  add constraint seller_profiles_vaccinations_count_check
    check (cardinality(vaccinations) <= 20),
  add constraint seller_profiles_additional_details_count_check
    check (cardinality(additional_details) <= 20);

create table public.seller_public_safety_checks (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(user_id) on delete cascade,
  check_type text not null check (check_type in (
    'background_check','social_media_check','enhanced_background_check',
    'motor_vehicle_report','premium_background_check'
  )),
  status text not null default 'not_on_file' check (status in (
    'not_on_file','pending','completed','expired','needs_attention'
  )),
  completed_at timestamptz,
  expires_at timestamptz,
  public_summary text check (public_summary is null or char_length(public_summary) <= 300),
  public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, check_type),
  check (status <> 'completed' or completed_at is not null)
);

create index seller_public_safety_checks_seller_public_idx
  on public.seller_public_safety_checks (seller_id, public)
  where public;

alter table public.seller_public_safety_checks enable row level security;

create policy seller_public_safety_checks_read
on public.seller_public_safety_checks for select
to anon, authenticated
using (
  (public and exists (
    select 1 from public.seller_profiles sp
    where sp.user_id = seller_id
      and sp.status = 'approved'
      and sp.profile_published_at is not null
  ))
  or seller_id = (select auth.uid())
  or app_private.has_admin_permission('kyc.review')
);

create policy seller_public_safety_checks_admin_insert
on public.seller_public_safety_checks for insert
to authenticated
with check (app_private.has_admin_permission('kyc.review'));

create policy seller_public_safety_checks_admin_update
on public.seller_public_safety_checks for update
to authenticated
using (app_private.has_admin_permission('kyc.review'))
with check (app_private.has_admin_permission('kyc.review'));

create policy seller_public_safety_checks_admin_delete
on public.seller_public_safety_checks for delete
to authenticated
using (app_private.has_admin_permission('kyc.review'));

grant select on public.seller_public_safety_checks to anon, authenticated;
grant insert, update, delete on public.seller_public_safety_checks to authenticated;

-- Carry forward the safe, public completion state from existing checks without
-- exposing vendor references, consent records or private screening results.
insert into public.seller_public_safety_checks (
  seller_id, check_type, status, completed_at, expires_at, public_summary
)
select distinct on (bc.seller_id)
  bc.seller_id,
  'background_check',
  case
    when bc.status = 'approved' and bc.completed_at is not null then 'completed'
    when bc.status in ('rejected','needs_information') then 'needs_attention'
    else 'pending'
  end,
  case when bc.status = 'approved' then bc.completed_at else null end,
  bc.expires_at,
  case when bc.status = 'approved' then bc.permitted_summary else null end
from public.background_checks bc
order by bc.seller_id, bc.updated_at desc
on conflict (seller_id, check_type) do nothing;

create or replace function app_private.seller_update_public_profile(
  p_display_name text,
  p_avatar_path text,
  p_headline text,
  p_languages text[],
  p_island_id uuid,
  p_locality text,
  p_vaccinations text[],
  p_additional_details text[]
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_display_name text := trim(coalesce(p_display_name, ''));
  v_avatar_path text := nullif(trim(coalesce(p_avatar_path, '')), '');
  v_languages text[];
  v_vaccinations text[];
  v_additional_details text[];
begin
  if v_user is null or not app_private.has_role('seller') then
    raise exception 'seller_required';
  end if;
  if char_length(v_display_name) not between 2 and 80 then
    raise exception 'invalid_display_name';
  end if;
  if char_length(trim(coalesce(p_headline, ''))) > 120 then
    raise exception 'profile_text_too_long';
  end if;

  select coalesce(array_agg(value order by ordinal), array['English']::text[])
  into v_languages
  from (
    select distinct on (lower(trim(item))) trim(item) as value, ordinal
    from unnest(coalesce(p_languages, array['English']::text[])) with ordinality as source(item, ordinal)
    where char_length(trim(item)) between 2 and 40
    order by lower(trim(item)), ordinal
  ) normalized;

  select coalesce(array_agg(value order by ordinal), '{}'::text[])
  into v_vaccinations
  from (
    select distinct on (lower(trim(item))) trim(item) as value, ordinal
    from unnest(coalesce(p_vaccinations, '{}'::text[])) with ordinality as source(item, ordinal)
    where char_length(trim(item)) between 2 and 80
    order by lower(trim(item)), ordinal
  ) normalized;

  select coalesce(array_agg(value order by ordinal), '{}'::text[])
  into v_additional_details
  from (
    select distinct on (lower(trim(item))) trim(item) as value, ordinal
    from unnest(coalesce(p_additional_details, '{}'::text[])) with ordinality as source(item, ordinal)
    where char_length(trim(item)) between 2 and 100
    order by lower(trim(item)), ordinal
  ) normalized;

  if cardinality(v_languages) not between 1 and 12
     or cardinality(v_vaccinations) > 20
     or cardinality(v_additional_details) > 20 then
    raise exception 'invalid_profile_details';
  end if;
  if p_island_id is not null and not exists (
    select 1 from public.islands where id = p_island_id and active
  ) then
    raise exception 'invalid_island';
  end if;
  if char_length(trim(coalesce(p_locality, ''))) > 100 then
    raise exception 'invalid_locality';
  end if;
  if v_avatar_path is not null and not exists (
    select 1 from storage.objects
    where bucket_id = 'public-profile-media'
      and name = v_avatar_path
      and owner_id = v_user::text
  ) then
    raise exception 'invalid_profile_photo';
  end if;

  update public.seller_profiles
  set display_name = v_display_name,
      avatar_path = v_avatar_path,
      headline = nullif(trim(coalesce(p_headline, '')), ''),
      languages = v_languages,
      island_id = p_island_id,
      locality = nullif(trim(coalesce(p_locality, '')), ''),
      vaccinations = v_vaccinations,
      additional_details = v_additional_details,
      updated_at = now()
  where user_id = v_user;

  if not found then raise exception 'seller_profile_not_found'; end if;

  update public.profiles
  set display_name = v_display_name,
      avatar_path = v_avatar_path,
      updated_at = now()
  where id = v_user;

  return jsonb_build_object('ok', true, 'avatar_path', v_avatar_path);
end
$function$;

create or replace function public.seller_update_public_profile(
  text,text,text,text[],uuid,text,text[],text[]
)
returns jsonb
language sql
set search_path=''
as $function$
  select app_private.seller_update_public_profile($1,$2,$3,$4,$5,$6,$7,$8);
$function$;

create or replace function app_private.seller_upsert_service(
  p_service_id uuid,
  p_rate_minor bigint,
  p_rate_max_minor bigint,
  p_service_bio text,
  p_years_experience integer,
  p_capabilities text[],
  p_additional_help text[],
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
  v_capabilities text[];
  v_additional_help text[];
  v_bio text := nullif(trim(coalesce(p_service_bio, '')), '');
begin
  if v_user is null or not app_private.has_role('seller') then raise exception 'seller_required'; end if;
  if p_rate_minor < 0 or (p_rate_max_minor is not null and p_rate_max_minor < p_rate_minor) then
    raise exception 'invalid_rate_range';
  end if;
  if p_years_experience not between 0 and 80 then raise exception 'invalid_experience'; end if;
  if not exists(select 1 from public.services where id=p_service_id and active) then
    raise exception 'service_not_available';
  end if;

  select coalesce(array_agg(value order by ordinal), '{}'::text[])
  into v_capabilities
  from (
    select distinct on (lower(trim(item))) trim(item) as value, ordinal
    from unnest(coalesce(p_capabilities, '{}'::text[])) with ordinality as source(item, ordinal)
    where char_length(trim(item)) between 2 and 100
    order by lower(trim(item)), ordinal
  ) normalized;

  select coalesce(array_agg(value order by ordinal), '{}'::text[])
  into v_additional_help
  from (
    select distinct on (lower(trim(item))) trim(item) as value, ordinal
    from unnest(coalesce(p_additional_help, '{}'::text[])) with ordinality as source(item, ordinal)
    where char_length(trim(item)) between 2 and 100
    order by lower(trim(item)), ordinal
  ) normalized;

  if cardinality(v_capabilities) > 30 or cardinality(v_additional_help) > 20 then
    raise exception 'too_many_service_details';
  end if;
  if p_active and (v_bio is null or char_length(v_bio) < 80 or cardinality(v_capabilities) = 0) then
    raise exception 'active_service_profile_incomplete';
  end if;

  insert into public.seller_services(
    seller_id,service_id,rate_minor,rate_max_minor,service_bio,years_experience,
    capabilities,additional_help,active,booking_modes
  ) values (
    v_user,p_service_id,p_rate_minor,p_rate_max_minor,v_bio,p_years_experience,
    v_capabilities,v_additional_help,p_active,array['scheduled','on_demand']::public.booking_mode[]
  )
  on conflict(seller_id,service_id) do update set
    rate_minor=excluded.rate_minor,
    rate_max_minor=excluded.rate_max_minor,
    service_bio=excluded.service_bio,
    years_experience=excluded.years_experience,
    capabilities=excluded.capabilities,
    additional_help=excluded.additional_help,
    active=excluded.active,
    updated_at=now()
  returning id into v_id;

  return jsonb_build_object('ok',true,'seller_service_id',v_id);
end
$function$;

create or replace function public.seller_upsert_service(
  uuid,bigint,bigint,text,integer,text[],text[],boolean
)
returns jsonb
language sql
set search_path=''
as $function$
  select app_private.seller_upsert_service($1,$2,$3,$4,$5,$6,$7,$8);
$function$;

revoke all on function app_private.seller_update_public_profile(text,text,text,text[],uuid,text,text[],text[]) from public,anon;
grant execute on function app_private.seller_update_public_profile(text,text,text,text[],uuid,text,text[],text[]) to authenticated;
revoke all on function public.seller_update_public_profile(text,text,text,text[],uuid,text,text[],text[]) from public,anon;
grant execute on function public.seller_update_public_profile(text,text,text,text[],uuid,text,text[],text[]) to authenticated;

revoke all on function app_private.seller_upsert_service(uuid,bigint,bigint,text,integer,text[],text[],boolean) from public,anon;
grant execute on function app_private.seller_upsert_service(uuid,bigint,bigint,text,integer,text[],text[],boolean) to authenticated;
revoke all on function public.seller_upsert_service(uuid,bigint,bigint,text,integer,text[],text[],boolean) from public,anon;
grant execute on function public.seller_upsert_service(uuid,bigint,bigint,text,integer,text[],text[],boolean) to authenticated;

create or replace view public.seller_directory
with (security_invoker=true)
as
select
  sp.user_id,
  sp.public_slug,
  sp.display_name,
  sp.headline,
  sp.languages,
  sp.vaccinations,
  sp.additional_details,
  sp.avatar_path,
  sp.locality,
  i.name as island,
  sp.rating_average,
  sp.rating_count,
  sp.completed_bookings,
  sp.response_rate,
  coalesce(service_data.services, '[]'::jsonb) as services,
  coalesce(badge_data.badges, '[]'::jsonb) as badges,
  coalesce(availability_data.availability, '[]'::jsonb) as availability,
  availability_data.last_updated_at as availability_updated_at,
  coalesce(credential_data.credentials, '[]'::jsonb) as credentials,
  coalesce(safety_data.safety_checks, '[]'::jsonb) as safety_checks
from public.seller_profiles sp
left join public.islands i on i.id=sp.island_id
left join lateral (
  select jsonb_agg(jsonb_build_object(
    'service_id',s.id,'name',s.name,'slug',s.slug,
    'rate_minor',ss.rate_minor,'rate_max_minor',ss.rate_max_minor,'currency',ss.currency,
    'bio',ss.service_bio,'years_experience',ss.years_experience,
    'capabilities',ss.capabilities,'additional_help',ss.additional_help
  ) order by s.name) as services
  from public.seller_services ss
  join public.services s on s.id=ss.service_id and s.active
  where ss.seller_id=sp.user_id and ss.active
) service_data on true
left join lateral (
  select jsonb_agg(jsonb_build_object('code',b.code,'name',b.name,'icon',b.icon_key) order by b.name) as badges
  from public.user_badges ub
  join public.badges b on b.id=ub.badge_id and b.active and b.public
  where ub.user_id=sp.user_id and ub.revoked_at is null and (ub.expires_at is null or ub.expires_at>now())
) badge_data on true
left join lateral (
  select jsonb_agg(jsonb_build_object(
    'weekday',ar.weekday,'start',ar.local_start,'end',ar.local_end,'timezone',ar.timezone
  ) order by ar.weekday,ar.local_start) as availability,
  max(ar.updated_at) as last_updated_at
  from public.availability_rules ar
  where ar.seller_id=sp.user_id and ar.active and ar.service_id is null and ar.service_area_id is null
) availability_data on true
left join lateral (
  select jsonb_agg(jsonb_build_object(
    'type',sc.credential_type,'issuing_body',sc.issuing_body,
    'verified_at',sc.verified_at,'expiry_date',sc.expiry_date
  ) order by sc.credential_type) as credentials
  from public.seller_credentials sc
  where sc.seller_id=sp.user_id and sc.status='approved'
) credential_data on true
left join lateral (
  select jsonb_agg(jsonb_build_object(
    'type',pc.check_type,'status',pc.status,'completed_at',pc.completed_at,
    'expires_at',pc.expires_at,'summary',pc.public_summary
  ) order by pc.check_type) as safety_checks
  from public.seller_public_safety_checks pc
  where pc.seller_id=sp.user_id and pc.public
) safety_data on true
where sp.status='approved' and sp.profile_published_at is not null;

grant select on public.seller_directory to anon,authenticated;
