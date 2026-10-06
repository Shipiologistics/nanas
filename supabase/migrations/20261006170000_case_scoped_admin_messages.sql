begin;

alter table public.admin_access_logs add column access_reason text;
alter table public.admin_access_logs add column message_count integer;
alter table public.admin_access_logs add column page_cursor jsonb;

-- Retire the old permission-only, unbounded endpoint, including owner calls.
create or replace function app_private.admin_conversation_messages(p_conversation_id uuid,p_purpose_code text)
returns jsonb language plpgsql security definer set search_path=''
as $$ begin raise exception 'case_context_required'; end; $$;
revoke all on function app_private.admin_conversation_messages(uuid,text) from public,anon,authenticated;
revoke all on function public.admin_conversation_messages(uuid,text) from public,anon,authenticated;

create function public.admin_conversation_message_page(
 p_conversation_id uuid,p_purpose_code text,p_case_id uuid,p_reason text,
 p_before_created_at timestamptz default null,p_before_id uuid default null,p_limit integer default 50
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_admin uuid:=auth.uid(); v_jwt jsonb:=auth.jwt(); v_auth_time bigint; v_now bigint:=floor(extract(epoch from clock_timestamp()));
 v_booking uuid; v_case_ok boolean:=false; v_permission text; v_reason text:=trim(coalesce(p_reason,''));
 v_rows jsonb; v_count integer; v_more boolean; v_cursor jsonb; v_audit uuid;
begin
 if v_admin is null or not app_private.has_admin_permission('messages.read') then raise exception 'permission_denied'; end if;
 perform 1 from public.profiles where id=v_admin and account_status='active' and deleted_at is null for share;
 if not found then raise exception 'permission_denied'; end if;
 -- iat and token_refresh are not proof of recent authentication. Accept the
 -- verified provider auth_time or an actual Supabase sign-in/MFA AMR event.
 select max(candidate::bigint) into v_auth_time from (
  select v_jwt->>'auth_time' as candidate
  union all
  select entry->>'timestamp' from jsonb_array_elements(
   case when jsonb_typeof(v_jwt->'amr')='array' then v_jwt->'amr' else '[]'::jsonb end) entry
  where entry->>'method' in ('password','otp','totp','oauth','sso/saml','magiclink','webauthn')
 ) candidates where candidate ~ '^[0-9]{1,12}$';
 if v_auth_time is null or v_auth_time>v_now or v_auth_time<=v_now-600 then raise exception 'recent_authentication_required'; end if;
 if p_case_id is null then raise exception 'case_context_required'; end if;
 if length(v_reason) not between 5 and 1000 then raise exception 'access_reason_required'; end if;
 v_permission:=case p_purpose_code when 'dispute-review' then 'disputes.manage'
  when 'support-case' then 'support.read' when 'safety-incident' then 'safety.read'
  when 'moderation-review' then 'moderation.read' end;
 if v_permission is null then raise exception 'invalid_access_purpose'; end if;
 if not app_private.has_admin_permission(v_permission) then raise exception 'permission_denied'; end if;
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid_page_size'; end if;
 if (p_before_id is null)<>(p_before_created_at is null) then raise exception 'invalid_message_cursor'; end if;
 select booking_id into v_booking from public.conversations where id=p_conversation_id for share;
 if not found then raise exception 'case_conversation_unavailable'; end if;
 if p_purpose_code='dispute-review' then
  select true into v_case_ok from public.service_disputes d join public.bookings b on b.id=d.booking_id
   where d.id=p_case_id and d.booking_id=v_booking and d.status not in ('resolved','closed')
    and d.opened_by in (b.buyer_id,b.seller_id) for share of d;
 elsif p_purpose_code='support-case' then
  select true into v_case_ok from public.support_cases c join public.bookings b on b.id=c.booking_id
   where c.id=p_case_id and c.booking_id=v_booking and c.status not in ('resolved','closed')
    and c.requester_id in (b.buyer_id,b.seller_id) for share of c;
 elsif p_purpose_code='safety-incident' then
  select true into v_case_ok from public.safety_incidents s join public.bookings b on b.id=s.booking_id
   where s.id=p_case_id and s.booking_id=v_booking and s.status not in ('resolved','closed')
    and s.reporter_id in (b.buyer_id,b.seller_id) for share of s;
 else
  -- A message report explicitly identifies the conversation. A review report
  -- identifies its booking. Profile/account reports alone do not authorize
  -- reading every conversation involving the target account.
  select true into v_case_ok from public.moderation_reports r where r.id=p_case_id
   and r.status not in ('resolved','closed') and (
    (r.target_type='message' and exists(select 1 from public.messages m where m.id=r.target_id and m.conversation_id=p_conversation_id))
    or (r.target_type='review' and exists(select 1 from public.reviews review where review.id=r.target_id and review.booking_id=v_booking))
   ) for share of r;
 end if;
 if not coalesce(v_case_ok,false) then raise exception 'case_conversation_unavailable'; end if;
 if p_before_id is not null and not exists(select 1 from public.messages where id=p_before_id
   and conversation_id=p_conversation_id and created_at=p_before_created_at)
 then raise exception 'invalid_message_cursor'; end if;
 select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc,page.id desc),'[]'::jsonb) into v_rows from (
  select m.id,m.conversation_id,m.sender_id,m.body,m.message_type,m.moderation_status,m.created_at
  from public.messages m where m.conversation_id=p_conversation_id and m.deleted_at is null
   and (p_before_id is null or (m.created_at,m.id)<(p_before_created_at,p_before_id))
  order by m.created_at desc,m.id desc limit p_limit+1
 ) page;
 v_more:=jsonb_array_length(v_rows)>p_limit;
 if v_more then v_rows:=v_rows-p_limit; end if;
 v_count:=jsonb_array_length(v_rows);
 v_cursor:=case when v_more then jsonb_build_object('id',v_rows->(v_count-1)->>'id','created_at',v_rows->(v_count-1)->>'created_at') else null end;
 insert into public.admin_access_logs(admin_user_id,resource_type,resource_id,purpose_code,case_id,access_reason,fields_accessed,message_count,page_cursor)
 values(v_admin,'conversation',p_conversation_id,p_purpose_code,p_case_id,v_reason,
  array['id','conversation_id','sender_id','body','message_type','moderation_status','created_at'],v_count,
  jsonb_build_object('before_id',p_before_id,'before_created_at',p_before_created_at,'limit',p_limit)) returning id into v_audit;
 return jsonb_build_object('ok',true,'conversation_id',p_conversation_id,'case_id',p_case_id,'purpose_code',p_purpose_code,
  'audit_id',v_audit,'messages',v_rows,'has_more',v_more,'next_cursor',v_cursor,'access_expires_at',to_timestamp(v_auth_time+600));
end;
$$;
revoke all on function public.admin_conversation_message_page(uuid,text,uuid,text,timestamptz,uuid,integer) from public,anon;
grant execute on function public.admin_conversation_message_page(uuid,text,uuid,text,timestamptz,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
