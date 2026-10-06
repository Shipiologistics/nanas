begin;

-- Keep has_role's restricted-account behavior for existing buyer/provider
-- obligations. Administrative authority, however, always requires active status.
create or replace function app_private.has_admin_permission(p_permission text)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(
 select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
 join public.admin_permissions a on a.admin_user_id=p.id
 where p.id=auth.uid() and p.account_status='active' and p.deleted_at is null
  and r.role='admin' and r.revoked_at is null and a.revoked_at is null
  and (a.permission_key=p_permission or a.permission_key='*')
) and p_permission is not null and length(trim(p_permission)) between 3 and 81; $$;

-- Only answers for the caller; does not expose another account's permissions.
create function public.admin_permission_allowed(p_permission text)
returns boolean language sql stable security invoker set search_path=''
as $$ select app_private.has_admin_permission(p_permission); $$;
revoke all on function public.admin_permission_allowed(text) from public,anon;
grant execute on function public.admin_permission_allowed(text) to authenticated;

-- The legacy Edge setting update used a privileged upsert and ignored an
-- independent audit-write failure. Both writes now share this transaction.
create function public.admin_set_system_setting(p_key text,p_value jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_key text:=trim(coalesce(p_key,'')); v_reason text:=trim(coalesce(p_reason,''));
begin
 if not app_private.has_admin_permission('config.manage') then raise exception 'permission_denied'; end if;
 if v_key !~ '^[a-z][a-z0-9_.-]{1,79}$' then raise exception 'invalid_setting_key'; end if;
 if p_value is null or jsonb_typeof(p_value)<>'object' or octet_length(p_value::text)>65536 then raise exception 'invalid_setting_value'; end if;
 if length(v_reason) not between 5 and 1000 then raise exception 'setting_reason_required'; end if;
 insert into public.system_settings(key,value,updated_by,updated_at) values(v_key,p_value,v_user,now())
 on conflict(key) do update set value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 insert into public.admin_audit_logs(actor_id,action,target_type,reason,after_redacted)
 values(v_user,'setting.update','system_setting',v_reason,jsonb_build_object('key',v_key));
 return jsonb_build_object('ok',true,'key',v_key);
end;
$$;
revoke all on function public.admin_set_system_setting(text,jsonb,text) from public,anon;
grant execute on function public.admin_set_system_setting(text,jsonb,text) to authenticated;
notify pgrst,'reload schema';
commit;
