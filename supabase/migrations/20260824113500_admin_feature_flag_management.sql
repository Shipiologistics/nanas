create or replace function app_private.admin_update_feature_flag(
  p_key text,
  p_enabled boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_before boolean;
begin
  if v_admin is null then raise exception 'authentication_required'; end if;
  if not app_private.has_admin_permission('config.manage') then raise exception 'admin_permission_required'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 5 and 1000 then raise exception 'reason_required'; end if;

  select enabled into v_before
  from public.feature_flags
  where key = p_key
  for update;
  if not found then raise exception 'feature_flag_not_found'; end if;

  update public.feature_flags
  set enabled = p_enabled, updated_by = v_admin, updated_at = now()
  where key = p_key;

  insert into public.admin_audit_logs(
    actor_id, action, target_type, before_redacted, after_redacted, reason
  ) values (
    v_admin, 'feature_flag.update', 'feature_flag',
    jsonb_build_object('key', p_key, 'enabled', v_before),
    jsonb_build_object('key', p_key, 'enabled', p_enabled),
    trim(p_reason)
  );

  insert into public.domain_events(aggregate_type, event_type, payload_redacted)
  values ('feature_flag', 'feature_flag.updated', jsonb_build_object('key', p_key, 'enabled', p_enabled));

  return jsonb_build_object('ok', true, 'key', p_key, 'enabled', p_enabled);
end
$function$;

create or replace function public.admin_update_feature_flag(
  p_key text,
  p_enabled boolean,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_update_feature_flag(p_key, p_enabled, p_reason);
$function$;

revoke all on function app_private.admin_update_feature_flag(text,boolean,text) from public, anon;
revoke all on function public.admin_update_feature_flag(text,boolean,text) from public, anon;
grant execute on function app_private.admin_update_feature_flag(text,boolean,text) to authenticated;
grant execute on function public.admin_update_feature_flag(text,boolean,text) to authenticated;
