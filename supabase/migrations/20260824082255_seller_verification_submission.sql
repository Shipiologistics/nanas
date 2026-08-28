begin;

create or replace function app_private.submit_verification_document(
  p_document_type text,
  p_storage_path text,
  p_original_name text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_document_id uuid;
  v_case_id uuid;
begin
  if v_user is null or not app_private.has_role('seller') then raise exception 'seller_role_required'; end if;
  if char_length(trim(coalesce(p_document_type,''))) not between 2 and 80 then raise exception 'invalid_document_type'; end if;
  if char_length(trim(coalesce(p_storage_path,''))) not between 10 and 500
    or split_part(p_storage_path,'/',1) <> v_user::text then raise exception 'invalid_storage_path'; end if;
  if not exists(select 1 from public.seller_profiles where user_id=v_user) then raise exception 'seller_profile_required'; end if;

  insert into public.seller_documents(seller_id,document_type,storage_path,status,metadata_redacted)
  values(v_user,left(trim(p_document_type),80),trim(p_storage_path),'pending',jsonb_build_object('original_name',left(coalesce(p_original_name,'document'),180)))
  returning id into v_document_id;

  select id into v_case_id
  from public.verification_cases
  where seller_id=v_user and verification_type=left(trim(p_document_type),80)
    and status in ('pending','needs_information')
  order by created_at desc limit 1 for update;
  if v_case_id is null then
    insert into public.verification_cases(seller_id,verification_type,vendor,status,result_summary)
    values(v_user,left(trim(p_document_type),80),'manual','pending','Awaiting authorized Nanas admin review')
    returning id into v_case_id;
  else
    update public.verification_cases set status='pending',decision_reason=null,updated_at=now() where id=v_case_id;
  end if;

  update public.seller_profiles
  set status=case when status in ('approved','paused') then status else 'under_review'::public.seller_status end,
      updated_at=now()
  where user_id=v_user;
  insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
  values('verification_case',v_case_id,'verification.document_submitted',jsonb_build_object('seller_id',v_user,'document_id',v_document_id,'document_type',left(trim(p_document_type),80)));
  insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
  select ur.user_id,'verification_case_ready','account','high',jsonb_build_object('case_id',v_case_id,'seller_id',v_user),
    'verification_ready:'||v_case_id::text||':'||ur.user_id::text
  from public.user_roles ur where ur.role='admin' and ur.revoked_at is null
  on conflict(dedupe_key) do nothing;

  return jsonb_build_object('ok',true,'document_id',v_document_id,'case_id',v_case_id,'status','pending');
end;
$$;

create or replace function public.submit_verification_document(
  p_document_type text,
  p_storage_path text,
  p_original_name text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select app_private.submit_verification_document(p_document_type,p_storage_path,p_original_name); $$;

revoke all on function public.submit_verification_document(text,text,text) from public,anon;
grant execute on function public.submit_verification_document(text,text,text) to authenticated;
revoke all on function app_private.submit_verification_document(text,text,text) from public,anon;
grant execute on function app_private.submit_verification_document(text,text,text) to authenticated;

commit;
