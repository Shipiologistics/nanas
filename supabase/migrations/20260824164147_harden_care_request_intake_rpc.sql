create or replace function public.create_care_request(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_result jsonb;
begin
  v_result := app_private.create_care_request(p_payload);
  perform app_private.attach_care_request_intake(p_payload,v_result);
  return v_result;
end; $$;

revoke all on function public.create_care_request(jsonb) from public,anon;
revoke all on function app_private.attach_care_request_intake(jsonb,jsonb) from public,anon;
grant execute on function public.create_care_request(jsonb) to authenticated;
grant execute on function app_private.attach_care_request_intake(jsonb,jsonb) to authenticated;
