begin;

create or replace function app_private.admin_review_verification(p_case_id uuid,p_decision public.verification_status,p_note text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_admin uuid := (select auth.uid()); v_case public.verification_cases%rowtype;
begin
  if not app_private.has_admin_permission('kyc.review') then raise exception 'permission_denied'; end if;
  if p_decision not in ('approved','rejected','needs_information') then raise exception 'invalid_decision'; end if;
  if char_length(trim(coalesce(p_note,'')))<3 then raise exception 'decision_note_required'; end if;
  select * into v_case from public.verification_cases where id=p_case_id for update;
  if not found then raise exception 'case_not_found'; end if;
  update public.verification_cases
  set status=p_decision,decision_reason=left(p_note,2000),admin_reviewer_id=v_admin,decided_at=now(),updated_at=now()
  where id=p_case_id;
  update public.seller_profiles
  set status=(case when p_decision='approved' then 'approved' when p_decision='rejected' then 'rejected' else 'needs_information' end)::public.seller_status,
      approved_at=case when p_decision='approved' then now() else approved_at end,
      updated_at=now()
  where user_id=v_case.seller_id;
  update public.seller_documents set status=p_decision,updated_at=now()
  where seller_id=v_case.seller_id and status in ('pending','needs_information');
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,after_redacted,reason)
  values(v_admin,'verification.'||p_decision::text,'verification_case',p_case_id,jsonb_build_object('seller_id',v_case.seller_id,'decision',p_decision),p_note);
  insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
  values(v_case.seller_id,'verification_decision','account','high',jsonb_build_object('case_id',p_case_id,'status',p_decision),'verification:'||p_case_id::text||':'||p_decision::text)
  on conflict(dedupe_key) do nothing;
  return jsonb_build_object('ok',true,'case_id',p_case_id,'seller_id',v_case.seller_id,'status',p_decision);
end;
$$;

commit;
