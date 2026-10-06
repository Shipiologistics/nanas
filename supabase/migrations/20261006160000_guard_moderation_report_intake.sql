begin;

-- Keep historical target kinds intact while admitting the two kinds supported
-- by the reporting/enforcement RPCs. Historical rows are not reclassified.
alter table public.moderation_reports drop constraint moderation_reports_target_type_check;
alter table public.moderation_reports add constraint moderation_reports_target_type_check
 check (target_type in ('profile','message','review','booking','document','seller_profile','user'));

-- Intake must own priority, status, assignment and the transactional event.
-- Reporter SELECT access remains unchanged; decisions use the admin RPC.
drop policy if exists moderation_reporter_insert on public.moderation_reports;
revoke insert,update,delete on public.moderation_reports from anon,authenticated;

create index moderation_reports_open_intake on public.moderation_reports
 (reporter_id,target_type,target_id,created_at,id) where status not in ('resolved','closed');

create or replace function app_private.report_content(
 p_target_type text,p_target_id uuid,p_reason_code text,p_details text default null
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid:=auth.uid(); v_visible boolean:=false; v_report public.moderation_reports%rowtype;
 v_reason text:=trim(coalesce(p_reason_code,''));
 v_details text:=nullif(trim(coalesce(p_details,'')),'');
begin
 if v_user is null then raise exception 'authentication_required'; end if;
 -- Restrictions must not take away the ability to report abuse. Closed,
 -- suspended or deleted accounts use the support/recovery process instead.
 if not exists(select 1 from public.profiles where id=v_user
   and account_status in ('active','restricted') and deleted_at is null)
 then raise exception 'reporting_account_unavailable'; end if;
 if p_target_type is null or p_target_type not in ('seller_profile','message','review','user')
 then raise exception 'invalid_target_type'; end if;
 if length(v_reason) not between 2 and 80 then raise exception 'invalid_reason'; end if;
 if length(coalesce(p_details,''))>3000 then raise exception 'details_too_long'; end if;

 -- No target/body/status is returned on failure. A missing UUID and an
 -- inaccessible UUID deliberately produce the same response.
 if p_target_type='seller_profile' then
  v_visible:=app_private.provider_directory_visible(p_target_id);
 elsif p_target_type='message' then
  select exists(select 1 from public.messages m where m.id=p_target_id
   and m.deleted_at is null and m.moderation_status='allowed'
   and app_private.is_conversation_member(m.conversation_id)
   and (m.sender_id=v_user or not app_private.conversation_is_locked(m.conversation_id))) into v_visible;
 elsif p_target_type='review' then
  select exists(select 1 from public.reviews r where r.id=p_target_id
   and (r.status='published' or r.author_id=v_user)) into v_visible;
 else
  -- A known counterparty remains reportable after blocking or account
  -- restriction. This does not reveal their private profile or message body.
  select exists(select 1 from public.profiles p where p.id=p_target_id and (
   app_private.provider_directory_visible(p.id)
   or exists(select 1 from public.bookings b where
    (b.buyer_id=v_user and b.seller_id=p.id) or (b.seller_id=v_user and b.buyer_id=p.id))
   or exists(select 1 from public.conversation_members mine
    join public.conversation_members peer on peer.conversation_id=mine.conversation_id
    where mine.user_id=v_user and mine.left_at is null and peer.user_id=p.id)
  )) into v_visible;
 end if;
 if not coalesce(v_visible,false) then raise exception 'report_target_unavailable'; end if;

 -- Identical open-report retries share a transaction lock; different accounts
 -- or changed narratives do not overwrite each other's reports. Closed cases
 -- may receive a fresh report. Do not duplicate the domain event on a replay.
 perform pg_advisory_xact_lock(hashtextextended('moderation-intake:'||v_user::text||':'||p_target_type||':'||p_target_id::text,0));
 select * into v_report from public.moderation_reports
 where reporter_id=v_user and target_type=p_target_type and target_id=p_target_id
  and reason_code=v_reason and details is not distinct from v_details
  and status not in ('resolved','closed')
 order by created_at,id limit 1 for update;
 if found then
  return jsonb_build_object('ok',true,'report_id',v_report.id,'status',v_report.status,'replayed',true);
 end if;
 insert into public.moderation_reports(reporter_id,target_type,target_id,reason_code,details,priority,status)
 values(v_user,p_target_type,p_target_id,v_reason,v_details,'normal','open') returning * into v_report;
 insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
 values('moderation_report',v_report.id,'moderation_report.created',jsonb_build_object('target_type',p_target_type,'target_id',p_target_id));
 return jsonb_build_object('ok',true,'report_id',v_report.id,'status','open','replayed',false);
end;
$$;

revoke all on function app_private.report_content(text,uuid,text,text) from public,anon;
revoke all on function public.report_content(text,uuid,text,text) from public,anon;
grant execute on function app_private.report_content(text,uuid,text,text) to authenticated;
grant execute on function public.report_content(text,uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
