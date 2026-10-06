begin;

-- One submission owns one evidence document, credential and private review case.
-- The same client-generated UUID safely recovers an uncertain network response.
create function public.submit_service_credential(p_submission_id uuid,p_credential_type text,
 p_service_id uuid,p_issuing_body text,p_issue_date date,p_expiry_date date,
 p_storage_path text,p_original_name text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare
 v_user uuid:=auth.uid(); v_existing public.seller_credentials%rowtype;
 v_type text:='service_credential:'||p_submission_id::text;
begin
 if v_user is null or not app_private.has_role('seller') or not exists(
   select 1 from public.profiles where id=v_user and account_status='active' and deleted_at is null
 ) then raise exception 'seller_role_required'; end if;
 if p_submission_id is null then raise exception 'submission_id_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text,0));
 select * into v_existing from public.seller_credentials where id=p_submission_id;
 if found then
   if v_existing.seller_id<>v_user then raise exception 'submission_id_conflict'; end if;
   if v_existing.credential_type is distinct from p_credential_type
     or v_existing.service_id is distinct from p_service_id
     or v_existing.issuing_body is distinct from trim(p_issuing_body)
     or v_existing.issue_date is distinct from p_issue_date
     or v_existing.expiry_date is distinct from p_expiry_date
     or not exists(select 1 from public.seller_documents d where d.id=v_existing.source_document_id
       and d.storage_path=p_storage_path and d.metadata_redacted->>'original_name'=left(coalesce(p_original_name,'document'),180))
   then raise exception 'submission_id_conflict'; end if;
   return jsonb_build_object('ok',true,'credential_id',p_submission_id,'case_id',p_submission_id,'replayed',true);
 end if;
 if not exists(select 1 from public.seller_profiles where user_id=v_user) then raise exception 'seller_profile_required'; end if;
 if p_credential_type is null or not exists(select 1 from public.services s
   where s.active and p_credential_type=any(s.required_credential_types)
     and (p_service_id is null or s.id=p_service_id)) then raise exception 'credential_type_not_required_for_scope'; end if;
 if p_credential_type='identity' then raise exception 'use_identity_verification'; end if;
 if char_length(trim(coalesce(p_issuing_body,''))) not between 2 and 160 then raise exception 'issuing_body_required'; end if;
 if p_issue_date is null or p_issue_date>(now() at time zone 'America/Nassau')::date
   or (p_expiry_date is not null and p_expiry_date<p_issue_date)
   then raise exception 'invalid_credential_dates'; end if;
 if char_length(coalesce(p_storage_path,'')) not between 10 and 500
   or split_part(p_storage_path,'/',1)<>v_user::text then raise exception 'invalid_storage_path'; end if;
 insert into public.seller_documents(id,seller_id,document_type,storage_path,issue_date,expiry_date,status,metadata_redacted)
 values(p_submission_id,v_user,v_type,p_storage_path,p_issue_date,p_expiry_date,'pending',
   jsonb_build_object('original_name',left(coalesce(p_original_name,'document'),180)));
 insert into public.seller_credentials(id,seller_id,service_id,credential_type,issuing_body,issue_date,expiry_date,status,source_document_id)
 values(p_submission_id,v_user,p_service_id,p_credential_type,trim(p_issuing_body),p_issue_date,p_expiry_date,'pending',p_submission_id);
 insert into public.verification_cases(id,seller_id,verification_type,status,result_summary)
 values(p_submission_id,v_user,v_type,'pending','Service credential: evidence and scope require authorized review');
 insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
 select ur.user_id,'verification_case_ready','account','high',jsonb_build_object('case_id',p_submission_id),
   'service_credential_ready:'||p_submission_id::text||':'||ur.user_id::text
 from public.user_roles ur where ur.role='admin' and ur.revoked_at is null
 on conflict(dedupe_key) do nothing;
 return jsonb_build_object('ok',true,'credential_id',p_submission_id,'case_id',p_submission_id,'replayed',false);
end $$;

create function public.service_credential_records(p_after uuid default null,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_admin boolean; v_rows jsonb; begin
 if auth.uid() is null then raise exception 'permission_denied'; end if;
 v_admin:=app_private.has_admin_permission('kyc.review');
 if not v_admin and not app_private.has_role('seller') then raise exception 'permission_denied'; end if;
 if p_limit is null or p_limit<1 or p_limit>100 then raise exception 'invalid_page_size'; end if;
 select coalesce(jsonb_agg(to_jsonb(row) order by row.id),'[]'::jsonb) into v_rows from(
   select c.id,c.seller_id,sp.display_name as provider_name,c.credential_type,c.service_id,s.name as service_name,
     c.issuing_body,c.issue_date,c.expiry_date,c.status,
     case when c.status='approved' and c.expiry_date<(now() at time zone 'America/Nassau')::date then 'expired'
       when c.status='approved' and c.issue_date>(now() at time zone 'America/Nassau')::date then 'not_yet_valid'
       else c.status::text end as effective_status,
     c.verified_at,c.created_at,v.id as case_id,v.decision_reason
   from public.seller_credentials c join public.seller_profiles sp on sp.user_id=c.seller_id
   left join public.services s on s.id=c.service_id
   left join public.verification_cases v on v.id=c.id and v.verification_type='service_credential:'||c.id::text
   where (v_admin or c.seller_id=auth.uid()) and (p_after is null or c.id>p_after)
   order by c.id limit p_limit+1
 ) row;
 return jsonb_build_object('items',v_rows,'page_size',p_limit);
end $$;

create function public.admin_review_service_credential(p_credential_id uuid,p_decision text,p_note text)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_admin uuid:=auth.uid(); v_record public.seller_credentials%rowtype;
 v_status public.verification_status; v_case public.verification_cases%rowtype;
begin
 if v_admin is null or not app_private.has_admin_permission('kyc.review') then raise exception 'permission_denied'; end if;
 if p_decision is null or p_decision not in ('approved','rejected','needs_information','revoked') then raise exception 'invalid_decision'; end if;
 if char_length(trim(coalesce(p_note,''))) not between 5 and 2000 then raise exception 'decision_note_required'; end if;
 select * into v_record from public.seller_credentials where id=p_credential_id for update;
 if not found then raise exception 'credential_not_found'; end if;
 -- Legacy credentials can be revoked but never newly approved without linked evidence.
 select * into v_case from public.verification_cases where id=p_credential_id
   and seller_id=v_record.seller_id and verification_type='service_credential:'||p_credential_id::text for update;
 if v_record.status::text=p_decision then
   return jsonb_build_object('ok',true,'credential_id',p_credential_id,'status',v_record.status,'replayed',true);
 end if;
 if p_decision='revoked' then
   if v_record.status not in ('approved','expired') then raise exception 'credential_not_revocable'; end if;
 else
   if v_record.status not in ('pending','needs_information') then raise exception 'credential_already_decided'; end if;
   if v_case.id is null or not exists(select 1 from public.seller_documents d
     where d.id=v_record.source_document_id and d.seller_id=v_record.seller_id
       and d.document_type=v_case.verification_type) then raise exception 'credential_evidence_required'; end if;
 end if;
 if p_decision='approved' then
   if v_record.issue_date is null or v_record.issue_date>(now() at time zone 'America/Nassau')::date
     or v_record.expiry_date<(now() at time zone 'America/Nassau')::date then raise exception 'credential_not_current'; end if;
   if not exists(select 1 from public.admin_access_logs a where a.admin_user_id=v_admin
     and a.resource_type='verification_case' and a.resource_id=v_case.id
     and a.purpose_code='verification_evidence_review' and a.created_at>now()-interval '1 hour')
     then raise exception 'inspect_credential_evidence_first'; end if;
 end if;
 v_status:=p_decision::public.verification_status;
 update public.seller_credentials set status=v_status,
   verified_by=case when p_decision='approved' then v_admin else verified_by end,
   verified_at=case when p_decision='approved' then now() else verified_at end,updated_at=now() where id=p_credential_id;
 if v_case.id is not null then
   update public.verification_cases set status=v_status,decision_reason=trim(p_note),admin_reviewer_id=v_admin,
     decided_at=now(),updated_at=now() where id=v_case.id;
 end if;
 update public.seller_documents set status=v_status,updated_at=now() where id=v_record.source_document_id;
 insert into public.admin_audit_logs(actor_id,action,target_type,target_id,before_redacted,after_redacted,reason)
 values(v_admin,'credential.'||p_decision,'seller_credential',p_credential_id,jsonb_build_object('status',v_record.status),
   jsonb_build_object('status',p_decision,'service_id',v_record.service_id,'credential_type',v_record.credential_type),trim(p_note));
 insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
 values(v_record.seller_id,'verification_decision','account','high',jsonb_build_object('case_id',v_case.id,'credential_id',p_credential_id,'status',p_decision),
   'service_credential:'||p_credential_id::text||':'||p_decision||':'||v_record.status::text)
 on conflict(dedupe_key) do nothing;
 return jsonb_build_object('ok',true,'credential_id',p_credential_id,'status',p_decision,'replayed',false);
end $$;

revoke all on function public.submit_service_credential(uuid,text,uuid,text,date,date,text,text),
 public.service_credential_records(uuid,integer),public.admin_review_service_credential(uuid,text,text) from public,anon;
grant execute on function public.submit_service_credential(uuid,text,uuid,text,date,date,text,text),
 public.service_credential_records(uuid,integer),public.admin_review_service_credential(uuid,text,text) to authenticated;

-- Legacy review stays available for identity documents, but cannot bypass the
-- credential workflow or change provider status for unrelated document types.
create or replace function app_private.admin_review_verification(
  p_case_id uuid, p_decision public.verification_status, p_note text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_admin uuid := (select auth.uid());
  v_case public.verification_cases%rowtype;
begin
  if not app_private.has_admin_permission('kyc.review') then raise exception 'permission_denied'; end if;
  if p_decision is null or p_decision not in ('approved','rejected','needs_information') then raise exception 'invalid_decision'; end if;
  if char_length(trim(coalesce(p_note,''))) not between 5 and 2000 then raise exception 'decision_note_required'; end if;
  select * into v_case from public.verification_cases where id=p_case_id for update;
  if not found then raise exception 'case_not_found'; end if;
  if v_case.verification_type like 'service_credential:%' then raise exception 'use_service_credential_review'; end if;
  if v_case.status in ('approved','rejected') then
    if v_case.status = p_decision then
      return jsonb_build_object('ok',true,'case_id',p_case_id,'seller_id',v_case.seller_id,'status',v_case.status,'already_processed',true);
    end if;
    raise exception 'case_already_decided';
  end if;
  if v_case.status not in ('pending','needs_information') then raise exception 'case_not_reviewable'; end if;
  if not exists (
    select 1 from public.seller_documents
    where seller_id=v_case.seller_id and document_type=v_case.verification_type
      and status in ('pending','needs_information')
  ) then raise exception 'verification_document_required'; end if;

  update public.verification_cases
  set status=p_decision,decision_reason=trim(p_note),admin_reviewer_id=v_admin,decided_at=now(),updated_at=now()
  where id=p_case_id;
  update public.seller_profiles
  set status=(case when p_decision='approved' and status='paused' then 'paused' when p_decision='approved' then 'approved' when p_decision='rejected' then 'rejected' else 'needs_information' end)::public.seller_status,
      approved_at=case when p_decision='approved' then now() else approved_at end, updated_at=now()
  where user_id=v_case.seller_id and v_case.verification_type in ('identity','Government identity');
  update public.seller_documents set status=p_decision,updated_at=now()
  where seller_id=v_case.seller_id and document_type=v_case.verification_type
    and status in ('pending','needs_information');
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,after_redacted,reason)
  values(v_admin,'verification.'||p_decision::text,'verification_case',p_case_id,
    jsonb_build_object('seller_id',v_case.seller_id,'document_type',v_case.verification_type,'decision',p_decision),trim(p_note));
  insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
  values(v_case.seller_id,'verification_decision','account','high',jsonb_build_object('case_id',p_case_id,'status',p_decision),
    'verification:'||p_case_id::text||':'||p_decision::text)
  on conflict(dedupe_key) do nothing;
  return jsonb_build_object('ok',true,'case_id',p_case_id,'seller_id',v_case.seller_id,'status',p_decision);
end;
$$;

revoke all on function app_private.admin_review_verification(uuid,public.verification_status,text) from public,anon;
grant execute on function app_private.admin_review_verification(uuid,public.verification_status,text) to authenticated;
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
  if trim(p_document_type) like 'service_credential:%' then raise exception 'use_service_credential_submission'; end if;
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

notify pgrst,'reload schema';
commit;
