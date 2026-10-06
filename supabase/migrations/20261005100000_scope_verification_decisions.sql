begin;

-- One case must not approve/reject unrelated document types for the provider.
-- Preserve the existing provider-status workflow, but make finalized case
-- decisions immutable and repeat submissions idempotent.
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
  set status=(case when p_decision='approved' then 'approved' when p_decision='rejected' then 'rejected' else 'needs_information' end)::public.seller_status,
      approved_at=case when p_decision='approved' then now() else approved_at end, updated_at=now()
  where user_id=v_case.seller_id;
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
commit;
