begin;

-- Historical actions only recorded a decision. Never replay them as if this
-- new enforcement transaction had already run.
alter table public.moderation_actions add column enforcement_applied boolean not null default false;

-- Visibility moderation is separate from identity approval and owner pauses.
create table app_private.provider_moderation (
 provider_id uuid primary key references public.seller_profiles(user_id),
 visibility public.moderation_status not null default 'allowed',
 updated_at timestamptz not null default now()
);
revoke all on app_private.provider_moderation from public,anon,authenticated;

create or replace function app_private.provider_directory_visible(p_provider uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(
 select 1 from public.seller_profiles sp join public.profiles p on p.id=sp.user_id
 where sp.user_id=p_provider and sp.status='approved' and sp.profile_published_at is not null
 and p.account_status='active' and p.deleted_at is null
 and not exists(select 1 from app_private.provider_moderation m where m.provider_id=sp.user_id and m.visibility<>'allowed')
) and not exists(select 1 from public.blocks b where
 (b.blocker_user_id=auth.uid() and b.blocked_user_id=p_provider) or
 (b.blocker_user_id=p_provider and b.blocked_user_id=auth.uid())); $$;

alter policy messages_members_only on public.messages using(
 deleted_at is null and moderation_status='allowed' and app_private.is_conversation_member(conversation_id)
 and (sender_id=auth.uid() or not app_private.conversation_is_locked(conversation_id))
);

create or replace function app_private.conversation_can_send(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select app_private.is_conversation_member(p_conversation_id)
 and exists(select 1 from public.profiles where id=auth.uid() and account_status='active' and deleted_at is null)
 and not app_private.conversation_is_locked(p_conversation_id)
 and exists(select 1 from public.conversations where id=p_conversation_id and status='active')
 and not exists(select 1 from public.conversation_members cm join public.blocks b
 on (b.blocker_user_id=auth.uid() and b.blocked_user_id=cm.user_id) or (b.blocked_user_id=auth.uid() and b.blocker_user_id=cm.user_id)
 where cm.conversation_id=p_conversation_id and cm.left_at is null); $$;

create or replace function app_private.admin_resolve_moderation_report(
 p_report_id uuid,p_action text,p_reason_code text,p_public_note text default null,
 p_private_note text default null,p_expires_at timestamptz default null
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_admin uuid:=auth.uid(); v_report public.moderation_reports%rowtype; v_previous public.moderation_actions%rowtype;
 v_action_id uuid; v_owner uuid; v_booking uuid; v_before text; v_after text; v_report_after public.case_status;
 v_public text:=nullif(trim(coalesce(p_public_note,'')),''); v_private text:=nullif(trim(coalesce(p_private_note,'')),'');
begin
 if v_admin is null or not app_private.has_admin_permission('moderation.manage') then raise exception 'admin_permission_required'; end if;
 if p_action is null or p_action not in ('allow','limit','remove','warn','restrict','escalate') then raise exception 'invalid_action'; end if;
 if char_length(trim(coalesce(p_reason_code,''))) not between 2 and 80 then raise exception 'invalid_reason'; end if;
 if char_length(coalesce(p_public_note,''))>1000 or char_length(coalesce(p_private_note,''))>2000 then raise exception 'note_too_long'; end if;
 -- No expiry worker exists for moderation. Never promise a temporary action
 -- while applying an indefinite restriction.
 if p_expires_at is not null then raise exception 'temporary_moderation_not_supported'; end if;
 select * into v_report from public.moderation_reports where id=p_report_id;
 if not found then raise exception 'report_not_found'; end if;
 if v_report.target_type not in ('message','review','seller_profile','user') then raise exception 'unsupported_target'; end if;
 if (p_action='restrict' and v_report.target_type not in ('user','seller_profile'))
 or (v_report.target_type='user' and p_action in ('limit','remove')) then raise exception 'action_not_supported_for_target'; end if;
 if p_action='restrict' and not app_private.has_admin_permission('users.enforce') then raise exception 'account_enforcement_permission_required'; end if;
 -- Match review submission/worker ordering: booking before review/rating rows.
 if v_report.target_type='review' then
  select booking_id into v_booking from public.reviews where id=v_report.target_id;
  perform 1 from public.bookings where id=v_booking for update;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('moderation:'||v_report.target_type||':'||v_report.target_id::text,0));
 select * into v_report from public.moderation_reports where id=p_report_id for update;
 select * into v_previous from public.moderation_actions where report_id=p_report_id order by created_at desc,id desc limit 1;
 if v_report.status in ('resolved','closed') and not coalesce(v_previous.enforcement_applied,false)
 then raise exception 'legacy_moderation_requires_new_report'; end if;
 if v_report.status in ('resolved','closed','escalated') and v_previous.id is not null and v_previous.enforcement_applied
  and v_previous.action=p_action and v_previous.reason_code=trim(p_reason_code)
  and v_previous.public_note is not distinct from v_public and v_previous.private_note is not distinct from v_private
  and v_previous.expires_at is not distinct from p_expires_at then
  return jsonb_build_object('ok',true,'replayed',true,'report_id',p_report_id,'action_id',v_previous.id,'action',p_action,'status',v_report.status);
 end if;
 if v_report.status in ('resolved','closed') then raise exception 'report_already_closed'; end if;

 if v_report.target_type='message' then
  select sender_id,moderation_status::text into v_owner,v_before from public.messages where id=v_report.target_id for update;
 elsif v_report.target_type='review' then
  select author_id,status::text into v_owner,v_before from public.reviews where id=v_report.target_id for update;
 elsif v_report.target_type='seller_profile' then
  perform 1 from public.profiles where id=v_report.target_id for update;
  select user_id into v_owner from public.seller_profiles where user_id=v_report.target_id for update;
  if v_owner is not null then
   insert into app_private.provider_moderation(provider_id) values(v_owner) on conflict do nothing;
   select visibility::text into v_before from app_private.provider_moderation where provider_id=v_owner for update;
  end if;
 else
  select id,account_status::text into v_owner,v_before from public.profiles where id=v_report.target_id for update;
 end if;
 if v_owner is null then raise exception 'moderation_target_not_found'; end if;
 v_after:=v_before;
 if p_action='restrict' then
  if v_owner=v_admin then raise exception 'self_enforcement_not_allowed'; end if;
  select account_status::text into v_before from public.profiles where id=v_owner for update;
  v_after:=case when v_before in ('closed','suspended','restricted') then v_before else 'restricted' end;
  update public.profiles set account_status=v_after::public.account_status,
   suspended_reason=case when v_before in ('closed','suspended','restricted') then suspended_reason else 'Moderation: '||trim(p_reason_code) end
  where id=v_owner;
 elsif v_report.target_type='message' and p_action in ('allow','limit','remove') then
  v_after:=case p_action when 'allow' then 'allowed' when 'limit' then 'limited' else 'removed' end;
  update public.messages set moderation_status=v_after::public.moderation_status where id=v_report.target_id;
 elsif v_report.target_type='review' and p_action in ('allow','limit','remove') then
  v_after:=case when p_action='remove' then 'removed' when p_action='limit' then 'hidden'
   when exists(select 1 from public.bookings b where b.id=v_booking and b.completed_at is not null
    and (b.completed_at<=now()-interval '7 days' or exists(select 1 from public.reviews peer
      where peer.booking_id=b.id and peer.id<>v_report.target_id))) then 'published' else 'pending_peer' end;
  update public.reviews set status=v_after::public.review_status,
   published_at=case when v_after='published' then coalesce(published_at,now()) else published_at end where id=v_report.target_id;
 elsif v_report.target_type='seller_profile' and p_action in ('allow','limit','remove') then
  v_after:=case p_action when 'allow' then 'allowed' when 'limit' then 'limited' else 'removed' end;
  update app_private.provider_moderation set visibility=v_after::public.moderation_status,updated_at=now() where provider_id=v_owner;
 end if;
 insert into public.moderation_actions(report_id,target_type,target_id,action,actor_admin_id,reason_code,public_note,private_note,expires_at,enforcement_applied)
 values(p_report_id,v_report.target_type,v_report.target_id,p_action,v_admin,trim(p_reason_code),v_public,v_private,null,true) returning id into v_action_id;
 v_report_after:=case when p_action='escalate' then 'escalated' else 'resolved' end;
 update public.moderation_reports set status=v_report_after,assigned_admin_id=v_admin,updated_at=now() where id=p_report_id;
 insert into public.admin_audit_logs(actor_id,action,target_type,target_id,before_redacted,after_redacted,reason)
 values(v_admin,'moderation.report.resolve','moderation_report',p_report_id,
  jsonb_build_object('status',v_report.status,'target_type',v_report.target_type,'target_state',v_before),
  jsonb_build_object('status',v_report_after,'action',p_action,'action_id',v_action_id,'target_state',v_after),trim(p_reason_code));
 insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
 values('moderation_report',p_report_id,case when p_action='escalate' then 'moderation_report.escalated' else 'moderation_report.resolved' end,
  jsonb_build_object('action',p_action,'action_id',v_action_id));
 if p_action='warn' then
  insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
  values(v_owner,'moderation_warning','account','high',jsonb_build_object('report_id',p_report_id,'action_id',v_action_id),
   'moderation_warning:'||v_action_id::text) on conflict(dedupe_key) do nothing;
 end if;
 return jsonb_build_object('ok',true,'replayed',false,'report_id',p_report_id,'action_id',v_action_id,'action',p_action,
  'status',v_report_after,'target_state',v_after);
end $$;
revoke all on function app_private.admin_resolve_moderation_report(uuid,text,text,text,text,timestamptz) from public,anon;
grant execute on function app_private.admin_resolve_moderation_report(uuid,text,text,text,text,timestamptz) to authenticated;

create or replace function app_private.provider_service_eligible(p_provider uuid,p_service uuid,p_area uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists (
   select 1 from public.seller_profiles sp
   join public.profiles p on p.id=sp.user_id and p.account_status='active' and p.deleted_at is null
   join public.user_roles ur on ur.user_id=p.id and ur.role='seller' and ur.revoked_at is null
   join public.seller_services ss on ss.seller_id=sp.user_id and ss.service_id=p_service and ss.active
   join public.services s on s.id=ss.service_id and s.active
   join public.seller_service_areas sa on sa.seller_id=sp.user_id and sa.service_area_id=p_area and sa.active
   join public.service_areas a on a.id=sa.service_area_id and a.active
   where sp.user_id=p_provider and sp.status='approved' and sp.profile_published_at is not null
     and not exists(select 1 from app_private.provider_moderation m where m.provider_id=sp.user_id and m.visibility<>'allowed')
     and not exists (
       select 1 from unnest(s.required_credential_types) requirement(kind)
       where not exists (
         select 1 from public.seller_credentials c
         where c.seller_id=p_provider and c.credential_type=requirement.kind and c.status='approved'
           and (c.service_id is null or c.service_id=p_service)
           and (c.issue_date is null or c.issue_date<=(now() at time zone 'America/Nassau')::date)
           and (c.expiry_date is null or c.expiry_date>=(now() at time zone 'America/Nassau')::date)
       ) and not (
         -- An identity review is not a nursing licence. Background-check
         -- consent and generic onboarding approval are not completed checks.
         requirement.kind='identity' and exists (
           select 1 from public.verification_cases v where v.seller_id=p_provider
             and v.verification_type in ('identity','Government identity') and v.status='approved'
             and (v.expires_at is null or v.expires_at>now())
         )
       )
     )
 );
$$;
revoke all on function app_private.provider_service_eligible(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function app_private.conversation_is_locked(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.conversation_members cm
  where cm.conversation_id=p_conversation_id and cm.user_id=(select auth.uid()) and cm.role='buyer' and cm.left_at is null)
  and exists(select 1 from public.messages m join public.conversation_members cm
    on cm.conversation_id=m.conversation_id and cm.user_id=m.sender_id
    where m.conversation_id=p_conversation_id and cm.role='seller' and m.deleted_at is null and m.moderation_status='allowed')
  and not exists(select 1 from public.conversation_access_purchases p
    where p.conversation_id=p_conversation_id and p.buyer_id=(select auth.uid())); $$;
create or replace function app_private.conversation_access_state()
returns jsonb language sql stable security definer set search_path=''
as $$ select coalesce(jsonb_agg(jsonb_build_object(
  'conversation_id',cm.conversation_id,'locked',app_private.conversation_is_locked(cm.conversation_id),
  'can_send',app_private.conversation_can_send(cm.conversation_id),'last_read_at',cm.last_read_at,
  'unread_count',(select count(*) from public.messages m where m.conversation_id=cm.conversation_id
    and m.sender_id<>cm.user_id and m.deleted_at is null and m.moderation_status='allowed' and (cm.last_read_at is null or m.created_at>cm.last_read_at)),
  'other_last_read_at',(select max(other.last_read_at) from public.conversation_members other
    where other.conversation_id=cm.conversation_id and other.user_id<>cm.user_id and other.left_at is null)
  )), '[]'::jsonb)
  from public.conversation_members cm where cm.user_id=(select auth.uid()) and cm.left_at is null; $$;
create or replace function public.mark_conversation_read_through(p_conversation_id uuid,p_message_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_time timestamptz;
begin
  if not app_private.is_conversation_member(p_conversation_id) then raise exception 'conversation_unavailable'; end if;
  if app_private.conversation_is_locked(p_conversation_id) then raise exception 'conversation_locked'; end if;
  select created_at into v_time from public.messages where id=p_message_id and conversation_id=p_conversation_id and deleted_at is null and moderation_status='allowed';
  if not found then raise exception 'message_unavailable'; end if;
  update public.conversation_members set last_read_at=greatest(coalesce(last_read_at,'-infinity'::timestamptz),least(v_time,now()))
    where conversation_id=p_conversation_id and user_id=(select auth.uid()) and left_at is null;
  return jsonb_build_object('ok',true,'read_through',v_time);
end;
$$;

-- Refresh cached older messages under the caller's ordinary row permissions.
create function public.conversation_message_history_subset(p_conversation_id uuid,p_message_ids uuid[])
returns jsonb language plpgsql security invoker set search_path=''
as $$ declare v_rows jsonb; begin
 if not app_private.is_conversation_member(p_conversation_id) then raise exception 'conversation_unavailable'; end if;
 if p_message_ids is null or cardinality(p_message_ids)>1000 then raise exception 'invalid_history_batch'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'conversation_id',m.conversation_id,'sender_id',m.sender_id,
  'body',m.body,'created_at',m.created_at) order by m.created_at,m.id),'[]'::jsonb) into v_rows
 from public.messages m where m.conversation_id=p_conversation_id and m.id=any(p_message_ids)
 and m.deleted_at is null and m.moderation_status='allowed';
 return v_rows;
end $$;
revoke all on function public.conversation_message_history_subset(uuid,uuid[]) from public,anon;
grant execute on function public.conversation_message_history_subset(uuid,uuid[]) to authenticated;

notify pgrst,'reload schema';
commit;
