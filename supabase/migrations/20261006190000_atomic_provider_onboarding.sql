begin;

-- Activation is enrollment, not a profile editor or a way to restore a
-- revoked role. Lock the account so concurrent onboarding cannot duplicate
-- resources or race an account-status change.
create or replace function app_private.activate_seller_profile(p_display_name text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_status public.seller_status;
begin
 if v_user is null then raise exception 'authentication_required'; end if;
 if char_length(trim(coalesce(p_display_name,''))) not between 2 and 80 then raise exception 'invalid_display_name'; end if;
 perform 1 from public.profiles where id=v_user and account_status='active' and deleted_at is null for update;
 if not found then raise exception 'account_not_active'; end if;
 perform 1 from public.user_roles where user_id=v_user and role in ('buyer','seller') and revoked_at is null for share;
 if not found then raise exception 'marketplace_role_required'; end if;
 if not exists(select 1 from public.user_roles where user_id=v_user and role='seller' and revoked_at is null)
  and exists(select 1 from public.user_roles where user_id=v_user and role='seller' and revoked_at is not null)
 then raise exception 'seller_role_revoked'; end if;
 insert into public.user_roles(user_id,role) values(v_user,'seller')
 on conflict(user_id,role) where revoked_at is null do nothing;
 insert into public.seller_profiles(user_id,display_name,public_slug)
 values(v_user,trim(p_display_name),'provider-'||v_user::text)
 on conflict(user_id) do nothing;
 insert into public.ledger_accounts(account_type,owner_user_id,currency)
 values('seller_wallet',v_user,'BSD') on conflict do nothing;
 select status into v_status from public.seller_profiles where user_id=v_user;
 return jsonb_build_object('ok',true,'seller_id',v_user,'status',v_status);
end $$;
revoke all on function app_private.activate_seller_profile(text),public.activate_seller_profile(text) from public,anon;
grant execute on function app_private.activate_seller_profile(text),public.activate_seller_profile(text) to authenticated;

-- Use the existing private identity-evidence workflow. A profile biography is
-- not identity evidence: do not create orphan "seller_onboarding" cases that
-- the identity reviewer cannot approve. Activation, validation and profile
-- changes are one transaction; callers need no direct table-write grants.
create or replace function public.submit_seller_application(
 p_display_name text,p_headline text,p_bio text,p_years_experience integer default 0
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid(); v_status public.seller_status; v_case_id uuid;
begin
 if v_user is null then raise exception 'authentication_required'; end if;
 if char_length(trim(coalesce(p_display_name,''))) not between 2 and 80 then raise exception 'invalid_display_name'; end if;
 if char_length(trim(coalesce(p_headline,''))) not between 1 and 120 then raise exception 'invalid_headline'; end if;
 if char_length(trim(coalesce(p_bio,''))) not between 1 and 2000 then raise exception 'invalid_bio'; end if;
 if p_years_experience is null or p_years_experience not between 0 and 80 then raise exception 'invalid_years_experience'; end if;
 -- Match the submission/review lock order: evidence-type lock first, then
 -- profile rows. Both supported identity labels must be serialized.
 perform pg_advisory_xact_lock(hashtextextended('verification:'||v_user::text||':Government identity',0));
 perform pg_advisory_xact_lock(hashtextextended('verification:'||v_user::text||':identity',0));
 perform app_private.activate_seller_profile(p_display_name);
 select status into v_status from public.seller_profiles where user_id=v_user for update;
 if v_status not in ('draft','submitted','needs_information','under_review') then raise exception 'application_not_editable'; end if;
 select c.id into v_case_id from public.verification_cases c
 where c.seller_id=v_user and c.verification_type in ('identity','Government identity')
  and c.status in ('pending','needs_information')
  and exists(select 1 from public.seller_documents d where d.seller_id=v_user
   and d.document_type=c.verification_type and d.status in ('pending','needs_information'))
 order by c.created_at desc,c.id desc limit 1 for update;
 if v_case_id is null then raise exception 'identity_verification_required'; end if;
 update public.seller_profiles set display_name=trim(p_display_name),headline=trim(p_headline),bio=trim(p_bio),
  years_experience=p_years_experience,status='under_review',updated_at=now() where user_id=v_user;
 return jsonb_build_object('ok',true,'seller_id',v_user,'verification_case_id',v_case_id,'status','under_review');
end $$;
revoke all on function public.submit_seller_application(text,text,text,integer) from public,anon;
grant execute on function public.submit_seller_application(text,text,text,integer) to authenticated;

commit;
