-- Sellers may publish between one and three distinct service profiles. Each
-- active category owns its biography, experience, qualifications and rates.
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
  v_existing_active boolean := false;
  v_total_count integer := 0;
  v_active_count integer := 0;
begin
  if v_user is null or not app_private.has_role('seller') then raise exception 'seller_required'; end if;
  if p_rate_minor < 0 or (p_rate_max_minor is not null and p_rate_max_minor < p_rate_minor) then
    raise exception 'invalid_rate_range';
  end if;
  if p_years_experience not between 0 and 80 then raise exception 'invalid_experience'; end if;
  if not exists(select 1 from public.services where id=p_service_id and active) then
    raise exception 'service_not_available';
  end if;

  -- Serialize profile-count decisions for this seller so simultaneous requests
  -- cannot both pass the three-profile limit.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  select coalesce(bool_or(service_id=p_service_id and active),false), count(*), count(*) filter(where active)
    into v_existing_active,v_total_count,v_active_count
  from public.seller_services
  where seller_id=v_user;

  if not exists(select 1 from public.seller_services where seller_id=v_user and service_id=p_service_id)
     and v_total_count >= 3 then
    raise exception 'service_profile_limit_reached';
  end if;
  if not p_active and v_existing_active and v_active_count <= 1 then
    raise exception 'at_least_one_active_service_required';
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
  if p_active and (v_bio is null or char_length(v_bio) < 180 or cardinality(v_capabilities) = 0) then
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

  return jsonb_build_object(
    'ok',true,
    'seller_service_id',v_id,
    'active_service_profiles',(select count(*) from public.seller_services where seller_id=v_user and active),
    'maximum_service_profiles',3
  );
end
$function$;

-- Upgrade the connected local acceptance seller so the buyer can immediately
-- compare three complete service-specific profiles.
update public.seller_services ss
set service_bio = case s.slug
      when 'senior-care' then 'Hello, I provide calm and dependable senior care for adults who want to remain comfortable and involved in their daily routines at home. I have experience supporting companionship, safe movement, meals, medication reminders and appointment preparation. I take time to understand each household’s preferences, communicate clearly with family members and preserve the dignity and independence of the person receiving care. I am happy to follow an established routine, provide thoughtful updates after each visit and adjust my approach within the agreed care plan as needs change.'
      when 'home-nursing' then 'Hello, I bring experienced nursing support into the home with a calm, respectful and safety-focused approach. I can help with approved health observations, medication support, wound-care assistance, recovery monitoring and clear care-plan communication. I explain what I am doing in plain language, listen carefully to the client and family, and document important observations through the Nanas booking workflow. My goal is to make each visit feel organized and reassuring while always working within my verified professional scope and the care instructions agreed before the booking.'
      else ss.service_bio
    end,
    years_experience = case s.slug when 'senior-care' then 6 when 'home-nursing' then 8 else ss.years_experience end,
    capabilities = case s.slug
      when 'senior-care' then array['Companionship','Mobility support','Meal preparation','Medication reminders','Appointment support','Family updates']::text[]
      when 'home-nursing' then array['Health observations','Medication support','Wound-care assistance','Recovery monitoring','Care-plan communication','Family education']::text[]
      else ss.capabilities
    end,
    additional_help = case s.slug
      when 'senior-care' then array['Groceries and errands','Transportation to appointments','Light organizing']::text[]
      when 'home-nursing' then array['Meal preparation','Mobility assistance','Family handover']::text[]
      else ss.additional_help
    end,
    updated_at = now()
from public.seller_profiles sp, public.services s
where sp.public_slug='nanas-test-seller'
  and ss.seller_id=sp.user_id
  and ss.service_id=s.id
  and s.slug in ('senior-care','home-nursing');

insert into public.seller_services(
  seller_id,service_id,rate_minor,rate_max_minor,service_bio,years_experience,
  capabilities,additional_help,active,booking_modes
)
select sp.user_id,s.id,4000,5800,
  'Hello, I help adults and families make the first days at home after a hospital stay or outpatient procedure feel safer and less overwhelming. I can support the agreed discharge routine, recovery observations, safe mobility, meal preparation, appointment reminders and practical organization around the home. I watch for changes that should be shared with the family or clinical team, communicate clearly after each visit and encourage the person receiving care to move at a comfortable pace. Every booking is shaped around the written care plan and remains within my approved Nanas scope.',
  5,
  array['Discharge-plan support','Recovery observations','Mobility assistance','Meal preparation','Appointment reminders','Family communication']::text[],
  array['Prescription pickup','Light cleaning','Transportation coordination']::text[],
  true,array['scheduled','on_demand']::public.booking_mode[]
from public.seller_profiles sp
join public.services s on s.slug='post-hospital-care' and s.active
where sp.public_slug='nanas-test-seller'
  and (
    exists(select 1 from public.seller_services existing where existing.seller_id=sp.user_id and existing.service_id=s.id)
    or (select count(*) from public.seller_services existing where existing.seller_id=sp.user_id) < 3
  )
on conflict(seller_id,service_id) do update set
  rate_minor=excluded.rate_minor,
  rate_max_minor=excluded.rate_max_minor,
  service_bio=excluded.service_bio,
  years_experience=excluded.years_experience,
  capabilities=excluded.capabilities,
  additional_help=excluded.additional_help,
  active=true,
  updated_at=now();
