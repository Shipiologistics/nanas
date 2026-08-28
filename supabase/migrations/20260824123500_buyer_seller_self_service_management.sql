create or replace function public.upsert_household_member(p_member_id uuid,p_relationship text,p_display_name text,p_date_of_birth date,p_care_notes text,p_active boolean)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_user uuid:=(select auth.uid()); v_household uuid; v_id uuid:=coalesce(p_member_id,gen_random_uuid());
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  select id into v_household from public.households where owner_user_id=v_user order by created_at limit 1;
  if v_household is null then insert into public.households(owner_user_id,name) values(v_user,'My household') returning id into v_household; end if;
  if char_length(trim(coalesce(p_display_name,''))) not between 1 and 80 then raise exception 'invalid_display_name'; end if;
  if char_length(trim(coalesce(p_relationship,''))) not between 1 and 40 then raise exception 'invalid_relationship'; end if;
  if p_member_id is null then
    insert into public.household_members(id,household_id,relationship,display_name,date_of_birth_private,care_notes_private,active)
    values(v_id,v_household,trim(p_relationship),trim(p_display_name),p_date_of_birth,nullif(trim(coalesce(p_care_notes,'')),''),p_active);
  else
    update public.household_members set relationship=trim(p_relationship),display_name=trim(p_display_name),date_of_birth_private=p_date_of_birth,care_notes_private=nullif(trim(coalesce(p_care_notes,'')),''),active=p_active,updated_at=now()
    where id=p_member_id and household_id=v_household;
    if not found then raise exception 'household_member_not_found'; end if;
  end if;
  return jsonb_build_object('ok',true,'member_id',v_id,'household_id',v_household);
end $function$;

create or replace function public.seller_upsert_service(p_service_id uuid,p_rate_minor bigint,p_experience_summary text,p_active boolean)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_user uuid:=(select auth.uid()); v_id uuid;
begin
  if v_user is null or not app_private.has_role('seller') then raise exception 'seller_required'; end if;
  if p_rate_minor<0 then raise exception 'invalid_rate'; end if;
  if not exists(select 1 from public.services where id=p_service_id and active) then raise exception 'service_not_available'; end if;
  insert into public.seller_services(seller_id,service_id,rate_minor,experience_summary,active,booking_modes)
  values(v_user,p_service_id,p_rate_minor,nullif(trim(coalesce(p_experience_summary,'')),''),p_active,array['scheduled','on_demand']::public.booking_mode[])
  on conflict(seller_id,service_id) do update set rate_minor=excluded.rate_minor,experience_summary=excluded.experience_summary,active=excluded.active,updated_at=now()
  returning id into v_id;
  return jsonb_build_object('ok',true,'seller_service_id',v_id);
end $function$;

create or replace function public.seller_replace_weekly_availability(p_weekdays smallint[],p_local_start time,p_local_end time)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_user uuid:=(select auth.uid()); v_day smallint; v_count integer:=0;
begin
  if v_user is null or not app_private.has_role('seller') then raise exception 'seller_required'; end if;
  if p_local_end<=p_local_start then raise exception 'invalid_time_window'; end if;
  if exists(select 1 from unnest(p_weekdays) d where d not between 0 and 6) then raise exception 'invalid_weekday'; end if;
  update public.availability_rules set active=false,updated_at=now() where seller_id=v_user and service_id is null and service_area_id is null and active;
  foreach v_day in array p_weekdays loop
    insert into public.availability_rules(seller_id,weekday,local_start,local_end,active)
    values(v_user,v_day,p_local_start,p_local_end,true); v_count:=v_count+1;
  end loop;
  return jsonb_build_object('ok',true,'rules_created',v_count);
end $function$;

create or replace function public.seller_update_public_profile(p_headline text,p_bio text,p_years_experience integer,p_languages text[],p_island_id uuid,p_locality text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_user uuid:=(select auth.uid());
begin
  if v_user is null or not app_private.has_role('seller') then raise exception 'seller_required'; end if;
  if char_length(trim(coalesce(p_headline,'')))>120 or char_length(trim(coalesce(p_bio,'')))>2000 then raise exception 'profile_text_too_long'; end if;
  if p_years_experience not between 0 and 80 then raise exception 'invalid_experience'; end if;
  update public.seller_profiles set headline=nullif(trim(coalesce(p_headline,'')),''),bio=nullif(trim(coalesce(p_bio,'')),''),years_experience=p_years_experience,languages=coalesce(p_languages,array['en-BS']::text[]),island_id=p_island_id,locality=nullif(trim(coalesce(p_locality,'')),''),updated_at=now() where user_id=v_user;
  if not found then raise exception 'seller_profile_not_found'; end if;
  return jsonb_build_object('ok',true);
end $function$;

create or replace function public.seller_upsert_service_area(p_service_area_id uuid,p_radius_km numeric,p_travel_fee_minor bigint,p_active boolean)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_user uuid:=(select auth.uid()); v_id uuid;
begin
  if v_user is null or not app_private.has_role('seller') then raise exception 'seller_required'; end if;
  if not exists(select 1 from public.service_areas where id=p_service_area_id and active) then raise exception 'area_not_available'; end if;
  insert into public.seller_service_areas(seller_id,service_area_id,radius_km,travel_fee_minor,active)
  values(v_user,p_service_area_id,p_radius_km,p_travel_fee_minor,p_active)
  on conflict(seller_id,service_area_id) do update set radius_km=excluded.radius_km,travel_fee_minor=excluded.travel_fee_minor,active=excluded.active,updated_at=now()
  returning id into v_id;
  return jsonb_build_object('ok',true,'seller_service_area_id',v_id);
end $function$;

revoke all on function public.upsert_household_member(uuid,text,text,date,text,boolean) from public,anon;
revoke all on function public.seller_upsert_service(uuid,bigint,text,boolean) from public,anon;
revoke all on function public.seller_replace_weekly_availability(smallint[],time,time) from public,anon;
revoke all on function public.seller_update_public_profile(text,text,integer,text[],uuid,text) from public,anon;
revoke all on function public.seller_upsert_service_area(uuid,numeric,bigint,boolean) from public,anon;
grant execute on function public.upsert_household_member(uuid,text,text,date,text,boolean), public.seller_upsert_service(uuid,bigint,text,boolean), public.seller_replace_weekly_availability(smallint[],time,time), public.seller_update_public_profile(text,text,integer,text[],uuid,text), public.seller_upsert_service_area(uuid,numeric,bigint,boolean) to authenticated;
