begin;

-- Publish only service eligibility, never evidence or private review details.
-- Definer access prevents anonymous RLS from hiding identity evidence needed
-- by the same authoritative predicate that protects quotes and checkout.
create function app_private.provider_directory_service_visible(p_provider uuid,p_service uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select app_private.provider_directory_visible(p_provider) and exists(
   select 1 from public.seller_service_areas a
   where a.seller_id=p_provider and a.active
     and app_private.provider_service_eligible(p_provider,p_service,a.service_area_id)
 );
$$;
revoke all on function app_private.provider_directory_service_visible(uuid,uuid) from public;
grant execute on function app_private.provider_directory_service_visible(uuid,uuid) to anon,authenticated;

alter policy seller_services_public_owner_admin on public.seller_services
 using(app_private.provider_directory_service_visible(seller_id,service_id)
   or seller_id=auth.uid() or app_private.has_admin_permission('sellers.read'));
alter policy credentials_public_owner_admin on public.seller_credentials
 using((status='approved'
   and (issue_date is null or issue_date <= (now() at time zone 'America/Nassau')::date)
   and (expiry_date is null or expiry_date >= (now() at time zone 'America/Nassau')::date)
   and app_private.provider_directory_visible(seller_id))
   or seller_id=auth.uid() or app_private.has_admin_permission('kyc.review'));

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
    and app_private.provider_directory_service_visible(sp.user_id,s.id)
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
    and (sc.issue_date is null or sc.issue_date <= (now() at time zone 'America/Nassau')::date)
    and (sc.expiry_date is null or sc.expiry_date >= (now() at time zone 'America/Nassau')::date)
) credential_data on true
left join lateral (
  select jsonb_agg(jsonb_build_object(
    'type',pc.check_type,'status',case when pc.status='completed' and pc.expires_at<=now() then 'expired' else pc.status end,'completed_at',pc.completed_at,
    'expires_at',pc.expires_at,'summary',pc.public_summary
  ) order by pc.check_type) as safety_checks
  from public.seller_public_safety_checks pc
  where pc.seller_id=sp.user_id and pc.public
) safety_data on true
where app_private.provider_directory_visible(sp.user_id)
  and jsonb_array_length(coalesce(service_data.services,'[]'::jsonb))>0;

grant select on public.seller_directory to anon,authenticated;

notify pgrst,'reload schema';
commit;
