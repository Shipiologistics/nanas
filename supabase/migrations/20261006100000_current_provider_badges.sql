begin;

-- Private qualification predicate. Account approval alone is not identity evidence.
create or replace function app_private.provider_rule_badge_eligible(p_user_id uuid,p_code text)
returns boolean language sql stable security definer set search_path=''
as $$
 select coalesce((
  select case p_code
   when 'identity_verified' then exists(
    select 1 from public.verification_cases v
    where v.seller_id=p_user_id and v.verification_type in ('identity','Government identity')
      and v.status='approved' and v.decided_at<=now()
      and (v.expires_at is null or v.expires_at>now())
      and exists(select 1 from public.seller_documents d
        where d.seller_id=v.seller_id and d.document_type=v.verification_type and d.status='approved'
          and d.uploaded_at<=v.decided_at
          and (d.issue_date is null or d.issue_date<=(now() at time zone 'America/Nassau')::date)
          and (d.expiry_date is null or d.expiry_date>=(now() at time zone 'America/Nassau')::date))
   )
   when 'credential_verified' then exists(
    select 1 from public.seller_credentials c
    join public.seller_documents d on d.id=c.source_document_id and d.seller_id=c.seller_id
    where c.seller_id=p_user_id and c.status='approved' and c.verified_by is not null
      and c.verified_at<=now() and d.status='approved' and d.document_type=c.credential_type
      and d.uploaded_at<=c.verified_at
      and (c.issue_date is null or c.issue_date<=(now() at time zone 'America/Nassau')::date)
      and (c.expiry_date is null or c.expiry_date>=(now() at time zone 'America/Nassau')::date)
      and (d.issue_date is null or d.issue_date<=(now() at time zone 'America/Nassau')::date)
      and (d.expiry_date is null or d.expiry_date>=(now() at time zone 'America/Nassau')::date)
   )
   when 'background_checked' then exists(
    select 1 from public.background_checks bc
    join public.verification_cases v on v.id=bc.verification_case_id and v.seller_id=bc.seller_id
    where bc.seller_id=p_user_id and bc.status='approved' and bc.completed_at<=now()
      and (bc.expires_at is null or bc.expires_at>now())
      and v.verification_type='background_check' and v.status='approved' and v.decided_at<=now()
      and (v.expires_at is null or v.expires_at>now())
   )
   when 'highly_rated' then s.rating_count>=10 and s.rating_average>=4.8
   when 'reliable_responder' then s.response_rate>=90
   when 'experienced_seller' then s.completed_bookings>=25
   else false end
  from public.seller_profiles s join public.profiles p on p.id=s.user_id
  where s.user_id=p_user_id and s.status='approved' and p.account_status='active' and p.deleted_at is null
    and exists(select 1 from public.user_roles r where r.user_id=s.user_id and r.role='seller' and r.revoked_at is null)
 ),false);
$$;
revoke all on function app_private.provider_rule_badge_eligible(uuid,text) from public,anon,authenticated;

-- Public boolean only for a provider already visible to this caller. The case,
-- document, dates and reviewer are never exposed. Known factual badges cannot
-- remain public solely because an old award row has not been revoked yet.
create function app_private.provider_badge_visible(p_user_id uuid,p_badge_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select app_private.provider_directory_visible(p_user_id) and exists(
  select 1 from public.badges b where b.id=p_badge_id and b.active and b.public
   and (b.validity_days is null or b.validity_days>0)
   and case when b.code in ('identity_verified','credential_verified','background_checked','highly_rated','reliable_responder','experienced_seller')
     then app_private.provider_rule_badge_eligible(p_user_id,b.code) else true end
 );
$$;
revoke all on function app_private.provider_badge_visible(uuid,uuid) from public;
grant execute on function app_private.provider_badge_visible(uuid,uuid) to anon,authenticated;

create or replace function app_private.evaluate_user_badges(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_seller public.seller_profiles%rowtype; v_badge public.badges%rowtype;
 v_result boolean; v_evaluated integer:=0; v_awarded integer:=0; v_revoked integer:=0;
 v_changed integer; v_metrics jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('provider-badges:'||p_user_id::text,0));
 select * into v_seller from public.seller_profiles where user_id=p_user_id for update;
 if not found then raise exception 'seller_not_found'; end if;
 v_metrics:=jsonb_build_object('rating',v_seller.rating_average,'reviews',v_seller.rating_count,
   'completed',v_seller.completed_bookings,'response_rate',v_seller.response_rate,'seller_status',v_seller.status);
 -- Only these four automated rules are managed here. Manual/custom awards and
 -- their audit history are not overwritten or revoked by this worker.
 for v_badge in select * from public.badges
   where code in ('identity_verified','highly_rated','reliable_responder','experienced_seller') order by id
 loop
  v_result:=v_badge.active and (v_badge.validity_days is null or v_badge.validity_days>0)
    and app_private.provider_rule_badge_eligible(p_user_id,v_badge.code);
  insert into public.badge_evaluation_runs(badge_id,rule_version,user_id,metrics_snapshot,result,result_reason)
  values(v_badge.id,v_badge.rule_version,p_user_id,v_metrics,v_result,
    case when v_result then 'rule_requirements_met' else 'rule_requirements_not_met' end);
  v_evaluated:=v_evaluated+1;
  update public.user_badges set revoked_at=now(),revoked_reason=case
    when not v_result then 'rule_requirements_not_met'
    when rule_version<>v_badge.rule_version then 'rule_version_changed' else 'award_expired' end
  where user_id=p_user_id and badge_id=v_badge.id and source_type='rule' and source_id=p_user_id
    and revoked_at is null
    and (not v_result or rule_version<>v_badge.rule_version or expires_at<=now());
  get diagnostics v_changed=row_count; v_revoked:=v_revoked+v_changed;
  if v_result then
   insert into public.user_badges(user_id,badge_id,source_type,source_id,rule_version,metric_snapshot,expires_at)
   values(p_user_id,v_badge.id,'rule',p_user_id,v_badge.rule_version,v_metrics,
     case when v_badge.validity_days is null then null else now()+make_interval(days=>v_badge.validity_days) end)
   on conflict(user_id,badge_id,source_type,source_id) where revoked_at is null do nothing;
   get diagnostics v_changed=row_count; v_awarded:=v_awarded+v_changed;
   update public.user_badges set metric_snapshot=v_metrics
    where user_id=p_user_id and badge_id=v_badge.id and source_type='rule' and source_id=p_user_id and revoked_at is null;
  end if;
 end loop;
 return jsonb_build_object('ok',true,'user_id',p_user_id,'evaluated',v_evaluated,'awarded',v_awarded,'revoked',v_revoked);
end $$;
revoke all on function app_private.evaluate_user_badges(uuid) from public,anon,authenticated;

-- Each page is one transaction. Only the worker service role can mutate awards.
create function public.evaluate_provider_badges(p_after uuid default null,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid; v_last uuid; v_result jsonb; v_providers integer:=0;
 v_evaluated integer:=0; v_awarded integer:=0; v_revoked integer:=0;
begin
 if p_limit is null or p_limit<1 or p_limit>200 then raise exception 'invalid_page_size'; end if;
 for v_user in select user_id from public.seller_profiles where p_after is null or user_id>p_after order by user_id limit p_limit
 loop
  v_result:=app_private.evaluate_user_badges(v_user);
  v_providers:=v_providers+1; v_last:=v_user;
  v_evaluated:=v_evaluated+(v_result->>'evaluated')::integer;
  v_awarded:=v_awarded+(v_result->>'awarded')::integer;
  v_revoked:=v_revoked+(v_result->>'revoked')::integer;
 end loop;
 return jsonb_build_object('ok',true,'providers',v_providers,'evaluated',v_evaluated,'awarded',v_awarded,'revoked',v_revoked,
  'next_cursor',case when exists(select 1 from public.seller_profiles where user_id>v_last) then v_last else null end);
end $$;
revoke all on function public.evaluate_provider_badges(uuid,integer) from public,anon,authenticated;
grant execute on function public.evaluate_provider_badges(uuid,integer) to service_role;

alter policy user_badges_public on public.user_badges using(
 (revoked_at is null and (expires_at is null or expires_at>now())
  and app_private.provider_badge_visible(user_id,badge_id)
  and (source_type<>'rule' or exists(select 1 from public.badges b where b.id=badge_id and b.rule_version=user_badges.rule_version)))
 or user_id=auth.uid() or app_private.has_admin_permission('badges.manage')
);

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
    and app_private.provider_badge_visible(ub.user_id,ub.badge_id)
    and (ub.source_type<>'rule' or ub.rule_version=b.rule_version)
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
