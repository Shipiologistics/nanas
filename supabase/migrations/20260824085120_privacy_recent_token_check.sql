-- Supabase access tokens expose `iat`; some identity providers also expose
-- `auth_time`. Accept either claim for the local recent-authentication gate.
create or replace function app_private.request_privacy_action(p_request_type text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_auth_time bigint := coalesce(
    nullif((select auth.jwt()->>'auth_time'), '')::bigint,
    nullif((select auth.jwt()->>'iat'), '')::bigint,
    0
  );
  v_request_id uuid;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_request_type not in ('export', 'delete') then raise exception 'invalid_privacy_request'; end if;
  if v_auth_time = 0 or extract(epoch from now())::bigint - v_auth_time > 900 then
    raise exception 'recent_authentication_required';
  end if;

  insert into public.privacy_requests(user_id, request_type, identity_verified_at, due_at)
  values(v_user, p_request_type, now(), now() + interval '30 days')
  returning id into v_request_id;

  insert into public.domain_events(aggregate_type, aggregate_id, event_type, payload_redacted)
  values(
    'privacy_request', v_request_id, 'privacy_request.created',
    jsonb_build_object('user_id', v_user, 'request_type', p_request_type)
  );

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'status', 'open',
    'request_type', p_request_type
  );
end
$function$;
