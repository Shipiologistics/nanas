begin;

create or replace function app_private.seller_replace_weekly_availability(p_weekdays smallint[],p_local_start time,p_local_end time)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_day smallint;v_count integer:=0;
begin
 if v_user is null or not app_private.has_role('seller') then raise exception 'seller_required'; end if;
 if p_weekdays is null or cardinality(p_weekdays)>7 or array_position(p_weekdays,null) is not null
  or (select count(distinct d) from unnest(p_weekdays) d)<>cardinality(p_weekdays) then raise exception 'invalid_weekdays'; end if;
 if p_local_start is null or p_local_end is null or p_local_end<=p_local_start then raise exception 'invalid_time_window'; end if;
 if exists(select 1 from unnest(p_weekdays) d where d not between 0 and 6) then raise exception 'invalid_weekday'; end if;
 if cardinality(p_weekdays)>0 then perform app_private.require_active_marketplace_accounts(array[v_user]); end if;
 perform pg_advisory_xact_lock(hashtextextended('availability:'||v_user::text,0));
 update public.availability_rules set active=false,updated_at=now()
 where seller_id=v_user and service_id is null and service_area_id is null and active;
 foreach v_day in array p_weekdays loop
  insert into public.availability_rules(seller_id,weekday,local_start,local_end,active)
  values(v_user,v_day,p_local_start,p_local_end,true);v_count:=v_count+1;
 end loop;
 return jsonb_build_object('ok',true,'rules_created',v_count);
end $$;

create or replace function app_private.seller_upsert_service_area(p_service_area_id uuid,p_radius_km numeric,p_travel_fee_minor bigint,p_active boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_id uuid;v_area_active boolean;v_existing boolean;
begin
 if v_user is null or not app_private.has_role('seller') then raise exception 'seller_required'; end if;
 if p_service_area_id is null or p_active is null or p_radius_km is null or p_radius_km not between 0 and 500
  or p_travel_fee_minor is null or p_travel_fee_minor<0 then raise exception 'invalid_coverage'; end if;
 select active into v_area_active from public.service_areas where id=p_service_area_id;
 if not found then raise exception 'area_not_available'; end if;
 select exists(select 1 from public.seller_service_areas where seller_id=v_user and service_area_id=p_service_area_id) into v_existing;
 if p_active then
  perform app_private.require_active_marketplace_accounts(array[v_user]);
  if not v_area_active then raise exception 'area_not_available'; end if;
 elsif not v_existing and not v_area_active then raise exception 'area_not_available'; end if;
 perform pg_advisory_xact_lock(hashtextextended('coverage:'||v_user::text,0));
 insert into public.seller_service_areas(seller_id,service_area_id,radius_km,travel_fee_minor,active)
 values(v_user,p_service_area_id,p_radius_km,p_travel_fee_minor,p_active)
 on conflict(seller_id,service_area_id) do update set radius_km=excluded.radius_km,
  travel_fee_minor=excluded.travel_fee_minor,active=excluded.active,updated_at=now()
 returning id into v_id;
 return jsonb_build_object('ok',true,'seller_service_area_id',v_id);
end $$;

create or replace function app_private.seller_upsert_service(
 p_service_id uuid,p_rate_minor bigint,p_rate_max_minor bigint,p_service_bio text,p_years_experience integer,
 p_capabilities text[],p_additional_help text[],p_active boolean
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid:=auth.uid();v_id uuid;v_capabilities text[];v_additional_help text[];
 v_bio text:=nullif(trim(coalesce(p_service_bio,'')),'');v_existing boolean;v_existing_visible boolean;
 v_total_count integer:=0;v_visible_count integer:=0;v_service_active boolean;
begin
 if v_user is null or not app_private.has_role('seller') then raise exception 'seller_required'; end if;
 if p_service_id is null or p_rate_minor is null or p_rate_minor<0 or (p_rate_max_minor is not null and p_rate_max_minor<p_rate_minor) then raise exception 'invalid_rate_range'; end if;
 if p_years_experience is null or p_years_experience not between 0 and 80 then raise exception 'invalid_experience'; end if;
 if p_active is null then raise exception 'invalid_service_status'; end if;
 select active into v_service_active from public.services where id=p_service_id;
 if not found then raise exception 'service_not_available'; end if;
 if p_active then perform app_private.require_active_marketplace_accounts(array[v_user]); end if;
 if p_active and not v_service_active then raise exception 'service_not_available'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));
 select exists(select 1 from public.seller_services where seller_id=v_user and service_id=p_service_id),
  exists(select 1 from public.seller_services ss join public.services s on s.id=ss.service_id
   where ss.seller_id=v_user and ss.service_id=p_service_id and ss.active and s.active),
  (select count(*) from public.seller_services where seller_id=v_user),
  (select count(*) from public.seller_services ss join public.services s on s.id=ss.service_id where ss.seller_id=v_user and ss.active and s.active)
 into v_existing,v_existing_visible,v_total_count,v_visible_count;
 if not v_existing and v_total_count>=3 then raise exception 'service_profile_limit_reached'; end if;
 if not p_active and v_existing_visible and v_visible_count<=1 then raise exception 'at_least_one_active_service_required'; end if;
 if not p_active and not v_existing and not v_service_active then raise exception 'service_not_available'; end if;
 select coalesce(array_agg(value order by ordinal),'{}'::text[]) into v_capabilities from (
  select distinct on(lower(trim(item))) trim(item) value,ordinal from unnest(coalesce(p_capabilities,'{}'::text[])) with ordinality source(item,ordinal)
  where char_length(trim(item)) between 2 and 100 order by lower(trim(item)),ordinal) normalized;
 select coalesce(array_agg(value order by ordinal),'{}'::text[]) into v_additional_help from (
  select distinct on(lower(trim(item))) trim(item) value,ordinal from unnest(coalesce(p_additional_help,'{}'::text[])) with ordinality source(item,ordinal)
  where char_length(trim(item)) between 2 and 100 order by lower(trim(item)),ordinal) normalized;
 if cardinality(v_capabilities)>30 or cardinality(v_additional_help)>20 then raise exception 'too_many_service_details'; end if;
 if p_active and (v_bio is null or char_length(v_bio)<180 or cardinality(v_capabilities)=0) then raise exception 'active_service_profile_incomplete'; end if;
 insert into public.seller_services(seller_id,service_id,rate_minor,rate_max_minor,service_bio,years_experience,capabilities,additional_help,active,booking_modes)
 values(v_user,p_service_id,p_rate_minor,p_rate_max_minor,v_bio,p_years_experience,v_capabilities,v_additional_help,p_active,array['scheduled','on_demand']::public.booking_mode[])
 on conflict(seller_id,service_id) do update set rate_minor=excluded.rate_minor,rate_max_minor=excluded.rate_max_minor,
  service_bio=excluded.service_bio,years_experience=excluded.years_experience,capabilities=excluded.capabilities,
  additional_help=excluded.additional_help,active=excluded.active,updated_at=now() returning id into v_id;
 return jsonb_build_object('ok',true,'seller_service_id',v_id,
  'active_service_profiles',(select count(*) from public.seller_services ss join public.services s on s.id=ss.service_id where ss.seller_id=v_user and ss.active and s.active),
  'maximum_service_profiles',3);
end $$;

create or replace function app_private.seller_set_publication(p_published boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_profile public.seller_profiles%rowtype;v_published_at timestamptz;
begin
 if v_user is null or not app_private.has_role('seller') then raise exception 'seller_required'; end if;
 if p_published is null then raise exception 'publication_choice_required'; end if;
 if p_published then perform app_private.require_active_marketplace_accounts(array[v_user]); end if;
 select * into v_profile from public.seller_profiles where user_id=v_user for update;
 if not found then raise exception 'seller_profile_required'; end if;
 if p_published then
  if v_profile.status<>'approved' then raise exception 'provider_approval_required'; end if;
  if char_length(trim(coalesce(v_profile.display_name,'')))<2 or char_length(trim(coalesce(v_profile.headline,'')))<10
   or char_length(trim(coalesce(v_profile.locality,'')))<2 or coalesce(cardinality(v_profile.languages),0)=0
   or not exists(select 1 from public.islands where id=v_profile.island_id and active) then raise exception 'complete_public_profile_first'; end if;
  if not exists(select 1 from public.seller_services ss join public.services s on s.id=ss.service_id
   where ss.seller_id=v_user and ss.active and s.active and ss.rate_minor>0 and char_length(trim(coalesce(ss.service_bio,'')))>=180 and cardinality(ss.capabilities)>0)
   then raise exception 'complete_service_profile_first'; end if;
  if not exists(select 1 from public.seller_service_areas sa join public.service_areas a on a.id=sa.service_area_id where sa.seller_id=v_user and sa.active and a.active)
   then raise exception 'active_coverage_required'; end if;
  if not exists(select 1 from public.availability_rules where seller_id=v_user and active) then raise exception 'availability_required'; end if;
  v_published_at:=coalesce(v_profile.profile_published_at,now());
 end if;
 update public.seller_profiles set profile_published_at=v_published_at,updated_at=now() where user_id=v_user;
 if v_profile.profile_published_at is distinct from v_published_at then insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
  values('seller_profile',v_user,case when p_published then 'provider.published' else 'provider.unpublished' end,jsonb_build_object('published',p_published)); end if;
 return jsonb_build_object('ok',true,'published_at',v_published_at);
end $$;

revoke all on function app_private.seller_replace_weekly_availability(smallint[],time,time),
 app_private.seller_upsert_service_area(uuid,numeric,bigint,boolean),
 app_private.seller_upsert_service(uuid,bigint,bigint,text,integer,text[],text[],boolean),
 app_private.seller_set_publication(boolean) from public,anon;
grant execute on function app_private.seller_replace_weekly_availability(smallint[],time,time),
 app_private.seller_upsert_service_area(uuid,numeric,bigint,boolean),
 app_private.seller_upsert_service(uuid,bigint,bigint,text,integer,text[],text[],boolean),
 app_private.seller_set_publication(boolean) to authenticated;

notify pgrst,'reload schema';
commit;
