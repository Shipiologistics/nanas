create or replace function app_private.admin_upsert_service(
  p_service_id uuid,
  p_category_id uuid,
  p_name text,
  p_description text,
  p_pricing_unit text,
  p_risk_level text,
  p_active boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_id uuid := coalesce(p_service_id, gen_random_uuid());
  v_before jsonb;
  v_slug text;
begin
  if v_admin is null then raise exception 'authentication_required'; end if;
  if not app_private.has_admin_permission('catalog.manage') then raise exception 'admin_permission_required'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 120 then raise exception 'invalid_service_name'; end if;
  if char_length(trim(coalesce(p_description, ''))) not between 10 and 2000 then raise exception 'invalid_service_description'; end if;
  if p_pricing_unit not in ('hour','visit','day','fixed') then raise exception 'invalid_pricing_unit'; end if;
  if p_risk_level not in ('standard','elevated','clinical') then raise exception 'invalid_risk_level'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 5 and 1000 then raise exception 'reason_required'; end if;
  if not exists(select 1 from public.service_categories where id = p_category_id) then raise exception 'category_not_found'; end if;

  if p_service_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g')) || '-' || left(replace(v_id::text, '-', ''), 8);
    insert into public.services(id, category_id, name, slug, description, pricing_unit, risk_level, active, booking_modes)
    values(v_id, p_category_id, trim(p_name), v_slug, trim(p_description), p_pricing_unit, p_risk_level, p_active, array['scheduled','on_demand']::public.booking_mode[]);
  else
    select jsonb_build_object('name',name,'active',active,'pricing_unit',pricing_unit,'risk_level',risk_level)
      into v_before from public.services where id = p_service_id for update;
    if not found then raise exception 'service_not_found'; end if;
    update public.services
    set category_id = p_category_id, name = trim(p_name), description = trim(p_description),
        pricing_unit = p_pricing_unit, risk_level = p_risk_level, active = p_active,
        version = version + 1, updated_at = now()
    where id = p_service_id;
  end if;

  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,before_redacted,after_redacted,reason)
  values(v_admin,case when p_service_id is null then 'catalog.service.create' else 'catalog.service.update' end,
    'service',v_id,v_before,jsonb_build_object('name',trim(p_name),'active',p_active,'pricing_unit',p_pricing_unit,'risk_level',p_risk_level),trim(p_reason));
  insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
  values('service',v_id,case when p_service_id is null then 'service.created' else 'service.updated' end,jsonb_build_object('name',trim(p_name),'active',p_active));
  return jsonb_build_object('ok',true,'service_id',v_id);
end
$function$;

create or replace function public.admin_upsert_service(
  p_service_id uuid,
  p_category_id uuid,
  p_name text,
  p_description text,
  p_pricing_unit text,
  p_risk_level text,
  p_active boolean,
  p_reason text
)
returns jsonb language sql security invoker set search_path=''
as $function$ select app_private.admin_upsert_service(p_service_id,p_category_id,p_name,p_description,p_pricing_unit,p_risk_level,p_active,p_reason); $function$;

create or replace function app_private.admin_upsert_service_area(
  p_area_id uuid,
  p_island_id uuid,
  p_name text,
  p_active boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_id uuid := coalesce(p_area_id, gen_random_uuid());
  v_before jsonb;
  v_slug text;
begin
  if v_admin is null then raise exception 'authentication_required'; end if;
  if not app_private.has_admin_permission('catalog.manage') then raise exception 'admin_permission_required'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 3 and 120 then raise exception 'invalid_area_name'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 5 and 1000 then raise exception 'reason_required'; end if;
  if not exists(select 1 from public.islands where id = p_island_id) then raise exception 'island_not_found'; end if;

  if p_area_id is null then
    v_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g')) || '-' || left(replace(v_id::text, '-', ''), 8);
    insert into public.service_areas(id,island_id,name,slug,active)
    values(v_id,p_island_id,trim(p_name),v_slug,p_active);
  else
    select jsonb_build_object('name',name,'island_id',island_id,'active',active)
      into v_before from public.service_areas where id = p_area_id for update;
    if not found then raise exception 'service_area_not_found'; end if;
    update public.service_areas
    set island_id=p_island_id,name=trim(p_name),active=p_active,updated_at=now()
    where id=p_area_id;
  end if;

  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,before_redacted,after_redacted,reason)
  values(v_admin,case when p_area_id is null then 'catalog.area.create' else 'catalog.area.update' end,
    'service_area',v_id,v_before,jsonb_build_object('name',trim(p_name),'island_id',p_island_id,'active',p_active),trim(p_reason));
  insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
  values('service_area',v_id,case when p_area_id is null then 'service_area.created' else 'service_area.updated' end,jsonb_build_object('name',trim(p_name),'active',p_active));
  return jsonb_build_object('ok',true,'service_area_id',v_id);
end
$function$;

create or replace function public.admin_upsert_service_area(
  p_area_id uuid,
  p_island_id uuid,
  p_name text,
  p_active boolean,
  p_reason text
)
returns jsonb language sql security invoker set search_path=''
as $function$ select app_private.admin_upsert_service_area(p_area_id,p_island_id,p_name,p_active,p_reason); $function$;

revoke all on function app_private.admin_upsert_service(uuid,uuid,text,text,text,text,boolean,text) from public,anon;
revoke all on function public.admin_upsert_service(uuid,uuid,text,text,text,text,boolean,text) from public,anon;
revoke all on function app_private.admin_upsert_service_area(uuid,uuid,text,boolean,text) from public,anon;
revoke all on function public.admin_upsert_service_area(uuid,uuid,text,boolean,text) from public,anon;
grant execute on function app_private.admin_upsert_service(uuid,uuid,text,text,text,text,boolean,text) to authenticated;
grant execute on function public.admin_upsert_service(uuid,uuid,text,text,text,text,boolean,text) to authenticated;
grant execute on function app_private.admin_upsert_service_area(uuid,uuid,text,boolean,text) to authenticated;
grant execute on function public.admin_upsert_service_area(uuid,uuid,text,boolean,text) to authenticated;
