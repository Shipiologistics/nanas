begin;

-- Authorize by the caller and stored case, never by a client-supplied owner/path.
create or replace function app_private.verification_evidence(p_case_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_case public.verification_cases%rowtype;
  v_documents jsonb;
begin
  if v_user is null then raise exception 'permission_denied'; end if;
  select * into v_case from public.verification_cases where id=p_case_id;
  if not found then raise exception 'evidence_not_found'; end if;
  if v_case.seller_id <> v_user and not app_private.has_admin_permission('kyc.review') then
    raise exception 'evidence_not_found';
  end if;
  if v_case.seller_id <> v_user then
    insert into public.admin_access_logs(admin_user_id,resource_type,resource_id,purpose_code,case_id,fields_accessed)
    values(v_user,'verification_case',p_case_id,'verification_evidence_review',p_case_id,
      array['document_type','storage_path','original_name','uploaded_at']);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',d.id,'seller_id',d.seller_id,'storage_path',d.storage_path,
    'name',coalesce(d.metadata_redacted->>'original_name','Verification document'),
    'status',d.status,'uploaded_at',d.uploaded_at
  ) order by d.uploaded_at desc),'[]'::jsonb) into v_documents
  from public.seller_documents d
  where d.seller_id=v_case.seller_id and d.document_type=v_case.verification_type;
  return v_documents;
end;
$$;

create or replace function public.verification_evidence(p_case_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.verification_evidence(p_case_id); $$;
revoke all on function public.verification_evidence(uuid) from public,anon;
revoke all on function app_private.verification_evidence(uuid) from public,anon;
grant execute on function public.verification_evidence(uuid) to authenticated;
grant execute on function app_private.verification_evidence(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
