begin;

-- Serialize generic submissions and decisions for one provider/type. Review
-- access is an audited retrieval, not proof that a human read the file.
create or replace function app_private.admin_review_verification(
 p_case_id uuid,p_decision public.verification_status,p_note text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_admin uuid:=auth.uid(); v_case public.verification_cases%rowtype;
 v_latest_evidence timestamptz; v_today date:=(now() at time zone 'America/Nassau')::date;
begin
 if not app_private.has_admin_permission('kyc.review') then raise exception 'permission_denied'; end if;
 if p_decision is null or p_decision not in ('approved','rejected','needs_information') then raise exception 'invalid_decision'; end if;
 if char_length(trim(coalesce(p_note,''))) not between 5 and 2000 then raise exception 'decision_note_required'; end if;
 select * into v_case from public.verification_cases where id=p_case_id;
 if not found then raise exception 'case_not_found'; end if;
 perform pg_advisory_xact_lock(hashtextextended('verification:'||v_case.seller_id::text||':'||v_case.verification_type,0));
 select * into v_case from public.verification_cases where id=p_case_id for update;
 if not found then raise exception 'case_not_found'; end if;
 if v_case.verification_type like 'service_credential:%' then raise exception 'use_service_credential_review'; end if;
 if v_case.status in ('approved','rejected') then
  if v_case.status=p_decision then return jsonb_build_object('ok',true,'case_id',p_case_id,'seller_id',v_case.seller_id,'status',v_case.status,'already_processed',true); end if;
  raise exception 'case_already_decided';
 end if;
 if v_case.status not in ('pending','needs_information') then raise exception 'case_not_reviewable'; end if;
 perform 1 from public.seller_documents where seller_id=v_case.seller_id and document_type=v_case.verification_type
  and status in ('pending','needs_information') for update;
 if not found then raise exception 'verification_document_required'; end if;
 if p_decision='approved' then
  if v_case.expires_at<=now() or exists(
   select 1 from public.seller_documents d where d.seller_id=v_case.seller_id and d.document_type=v_case.verification_type
    and d.status in ('pending','needs_information')
    and (d.uploaded_at>now() or d.issue_date>v_today or d.expiry_date<v_today
      or (d.issue_date is not null and d.expiry_date<d.issue_date))
  ) then raise exception 'verification_evidence_not_current'; end if;
  select max(greatest(uploaded_at,updated_at)) into v_latest_evidence from public.seller_documents
   where seller_id=v_case.seller_id and document_type=v_case.verification_type and status in ('pending','needs_information');
  if not exists(select 1 from public.admin_access_logs a where a.admin_user_id=v_admin
   and a.resource_type='verification_case' and a.resource_id=p_case_id and a.case_id=p_case_id
   and a.purpose_code='verification_evidence_review' and a.created_at>now()-interval '1 hour'
   and a.created_at<=clock_timestamp() and a.created_at>=v_latest_evidence
  ) then raise exception 'inspect_current_verification_evidence_first'; end if;
 end if;
 update public.verification_cases set status=p_decision,decision_reason=trim(p_note),admin_reviewer_id=v_admin,
  decided_at=now(),updated_at=now() where id=p_case_id;
 update public.seller_profiles
 set status=(case when p_decision='approved' and status='paused' then 'paused' when p_decision='approved' then 'approved'
  when p_decision='rejected' then 'rejected' else 'needs_information' end)::public.seller_status,
  approved_at=case when p_decision='approved' then now() else approved_at end,updated_at=now()
 where user_id=v_case.seller_id and v_case.verification_type in ('identity','Government identity');
 update public.seller_documents set status=p_decision,updated_at=now()
 where seller_id=v_case.seller_id and document_type=v_case.verification_type and status in ('pending','needs_information');
 insert into public.admin_audit_logs(actor_id,action,target_type,target_id,after_redacted,reason)
 values(v_admin,'verification.'||p_decision::text,'verification_case',p_case_id,
  jsonb_build_object('seller_id',v_case.seller_id,'document_type',v_case.verification_type,'decision',p_decision),trim(p_note));
 insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
 values(v_case.seller_id,'verification_decision','account','high',jsonb_build_object('case_id',p_case_id,'status',p_decision),
  'verification:'||p_case_id::text||':'||p_decision::text) on conflict(dedupe_key) do nothing;
 return jsonb_build_object('ok',true,'case_id',p_case_id,'seller_id',v_case.seller_id,'status',p_decision);
end $$;
revoke all on function app_private.admin_review_verification(uuid,public.verification_status,text) from public,anon;
grant execute on function app_private.admin_review_verification(uuid,public.verification_status,text) to authenticated;

create or replace function app_private.submit_verification_document(p_document_type text,p_storage_path text,p_original_name text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_document_id uuid; v_case_id uuid;
begin
 if v_user is null or not app_private.has_role('seller') then raise exception 'seller_role_required'; end if;
 if trim(p_document_type) like 'service_credential:%' then raise exception 'use_service_credential_submission'; end if;
 if char_length(trim(coalesce(p_document_type,''))) not between 2 and 80 then raise exception 'invalid_document_type'; end if;
 if char_length(trim(coalesce(p_storage_path,''))) not between 10 and 500
  or split_part(p_storage_path,'/',1)<>v_user::text then raise exception 'invalid_storage_path'; end if;
 if not exists(select 1 from public.seller_profiles where user_id=v_user) then raise exception 'seller_profile_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('verification:'||v_user::text||':'||trim(p_document_type),0));
 insert into public.seller_documents(seller_id,document_type,storage_path,status,metadata_redacted,uploaded_at)
 values(v_user,trim(p_document_type),trim(p_storage_path),'pending',jsonb_build_object('original_name',left(coalesce(p_original_name,'document'),180)),clock_timestamp())
 returning id into v_document_id;
 select id into v_case_id from public.verification_cases
 where seller_id=v_user and verification_type=trim(p_document_type) and status in ('pending','needs_information')
 order by created_at desc,id desc limit 1 for update;
 if v_case_id is null then
  insert into public.verification_cases(seller_id,verification_type,vendor,status,result_summary)
  values(v_user,trim(p_document_type),'manual','pending','Awaiting authorized Nanas admin review') returning id into v_case_id;
 else
  update public.verification_cases set status='pending',decision_reason=null,updated_at=now() where id=v_case_id;
 end if;
 update public.seller_profiles set status=case when status in ('approved','paused') then status else 'under_review'::public.seller_status end,
  updated_at=now() where user_id=v_user;
 insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
 values('verification_case',v_case_id,'verification.document_submitted',jsonb_build_object('seller_id',v_user,'document_id',v_document_id,'document_type',trim(p_document_type)));
 insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
 select ur.user_id,'verification_case_ready','account','high',jsonb_build_object('case_id',v_case_id,'seller_id',v_user),
  'verification_ready:'||v_case_id::text||':'||ur.user_id::text from public.user_roles ur where ur.role='admin' and ur.revoked_at is null
 on conflict(dedupe_key) do nothing;
 return jsonb_build_object('ok',true,'document_id',v_document_id,'case_id',v_case_id,'status','pending');
end $$;
revoke all on function app_private.submit_verification_document(text,text,text) from public,anon;
grant execute on function app_private.submit_verification_document(text,text,text) to authenticated;

-- Timestamp access after the serialized snapshot, so a later submission cannot
-- inherit an earlier review. Keep private evidence limited to its owner/reviewer.
create or replace function app_private.verification_evidence(p_case_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_case public.verification_cases%rowtype; v_documents jsonb;
begin
 if v_user is null then raise exception 'permission_denied'; end if;
 select * into v_case from public.verification_cases where id=p_case_id;
 if not found or (v_case.seller_id<>v_user and not app_private.has_admin_permission('kyc.review')) then raise exception 'evidence_not_found'; end if;
 perform pg_advisory_xact_lock(hashtextextended('verification:'||v_case.seller_id::text||':'||v_case.verification_type,0));
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'seller_id',d.seller_id,'storage_path',d.storage_path,
  'name',coalesce(d.metadata_redacted->>'original_name','Verification document'),'status',d.status,'uploaded_at',d.uploaded_at,
  'issue_date',d.issue_date,'expiry_date',d.expiry_date) order by d.uploaded_at desc,d.id desc),'[]'::jsonb)
 into v_documents from public.seller_documents d where d.seller_id=v_case.seller_id and d.document_type=v_case.verification_type;
 if v_case.seller_id<>v_user then
  insert into public.admin_access_logs(admin_user_id,resource_type,resource_id,purpose_code,case_id,fields_accessed,created_at)
  values(v_user,'verification_case',p_case_id,'verification_evidence_review',p_case_id,
   array['document_type','storage_path','original_name','uploaded_at','issue_date','expiry_date'],clock_timestamp());
 end if;
 return v_documents;
end $$;
revoke all on function app_private.verification_evidence(uuid) from public,anon;
grant execute on function app_private.verification_evidence(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
