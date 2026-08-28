create or replace function app_private.admin_manage_operations_case(
  p_case_kind text,
  p_case_id uuid,
  p_action text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_before text;
  v_after text;
begin
  if v_admin is null then raise exception 'authentication_required'; end if;
  if p_action not in ('assign','acknowledge','resolve') then raise exception 'invalid_action'; end if;
  if char_length(trim(coalesce(p_note,''))) not between 5 and 1000 then raise exception 'reason_required'; end if;

  if p_case_kind='support' then
    if not app_private.has_admin_permission('support.manage') then raise exception 'admin_permission_required'; end if;
    select status::text into v_before from public.support_cases where id=p_case_id for update;
    if not found then raise exception 'support_case_not_found'; end if;
    if v_before in ('resolved','closed') then raise exception 'case_already_closed'; end if;
    v_after:=case when p_action='resolve' then 'resolved' else 'awaiting_admin' end;
    update public.support_cases
    set owner_admin_id=v_admin,status=v_after::public.case_status,
        resolved_at=case when p_action='resolve' then now() else resolved_at end,
        updated_at=now()
    where id=p_case_id;
  elsif p_case_kind='safety' then
    if not app_private.has_admin_permission('safety.manage') then raise exception 'admin_permission_required'; end if;
    select status::text into v_before from public.safety_incidents where id=p_case_id for update;
    if not found then raise exception 'safety_incident_not_found'; end if;
    if v_before in ('resolved','closed') then raise exception 'case_already_closed'; end if;
    v_after:=case when p_action='resolve' then 'resolved' else 'awaiting_admin' end;
    update public.safety_incidents
    set assigned_admin_id=v_admin,status=v_after::public.case_status,
        acknowledged_at=case when p_action in ('acknowledge','resolve') then coalesce(acknowledged_at,now()) else acknowledged_at end,
        resolved_at=case when p_action='resolve' then now() else resolved_at end,
        updated_at=now()
    where id=p_case_id;
  else
    raise exception 'invalid_case_kind';
  end if;

  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,before_redacted,after_redacted,reason)
  values(v_admin,'operations_case.'||p_action,p_case_kind||'_case',p_case_id,jsonb_build_object('status',v_before),jsonb_build_object('status',v_after,'assigned_admin_id',v_admin),trim(p_note));
  insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
  values(p_case_kind||'_case',p_case_id,p_case_kind||'_case.'||p_action,jsonb_build_object('status',v_after,'admin_id',v_admin));
  return jsonb_build_object('ok',true,'case_kind',p_case_kind,'case_id',p_case_id,'action',p_action,'status',v_after);
end
$function$;

create or replace function public.admin_manage_operations_case(
  p_case_kind text,
  p_case_id uuid,
  p_action text,
  p_note text
)
returns jsonb language sql security invoker set search_path=''
as $function$ select app_private.admin_manage_operations_case(p_case_kind,p_case_id,p_action,p_note); $function$;

revoke all on function app_private.admin_manage_operations_case(text,uuid,text,text) from public,anon;
revoke all on function public.admin_manage_operations_case(text,uuid,text,text) from public,anon;
grant execute on function app_private.admin_manage_operations_case(text,uuid,text,text) to authenticated;
grant execute on function public.admin_manage_operations_case(text,uuid,text,text) to authenticated;
