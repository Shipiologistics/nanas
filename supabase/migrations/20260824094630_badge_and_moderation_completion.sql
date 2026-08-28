begin;

create table public.badge_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  badge_id uuid not null references public.badges(id),
  rule_version integer not null,
  user_id uuid references public.profiles(id),
  cohort_key text,
  metrics_snapshot jsonb not null default '{}'::jsonb,
  result boolean not null,
  result_reason text,
  evaluated_at timestamptz not null default now(),
  check (user_id is not null or cohort_key is not null)
);

create index badge_evaluation_user_time
  on public.badge_evaluation_runs(user_id, evaluated_at desc)
  where user_id is not null;

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.moderation_reports(id),
  target_type text not null,
  target_id uuid not null,
  action text not null check (action in ('allow','limit','remove','warn','restrict','escalate')),
  actor_admin_id uuid not null references public.profiles(id),
  reason_code text not null check (char_length(reason_code) between 2 and 80),
  public_note text check (public_note is null or char_length(public_note) <= 1000),
  private_note text check (private_note is null or char_length(private_note) <= 2000),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index moderation_actions_target_time
  on public.moderation_actions(target_type, target_id, created_at desc);
create index moderation_actions_report
  on public.moderation_actions(report_id)
  where report_id is not null;

alter table public.badge_evaluation_runs enable row level security;
alter table public.moderation_actions enable row level security;

create policy moderation_actions_admin_read
  on public.moderation_actions
  for select
  to authenticated
  using (app_private.has_admin_permission('moderation.read'));

revoke all on public.badge_evaluation_runs from anon, authenticated;
revoke all on public.moderation_actions from anon, authenticated;
grant select on public.moderation_actions to authenticated;

create or replace function app_private.report_content(
  p_target_type text,
  p_target_id uuid,
  p_reason_code text,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_report_id uuid;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_target_type not in ('seller_profile','message','review','user') then raise exception 'invalid_target_type'; end if;
  if char_length(trim(p_reason_code)) not between 2 and 80 then raise exception 'invalid_reason'; end if;
  if p_details is not null and char_length(p_details) > 3000 then raise exception 'details_too_long'; end if;

  insert into public.moderation_reports(reporter_id,target_type,target_id,reason_code,details,priority,status)
  values(v_user,p_target_type,p_target_id,trim(p_reason_code),nullif(trim(coalesce(p_details,'')),''),'normal','open')
  returning id into v_report_id;

  insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
  values('moderation_report',v_report_id,'moderation_report.created',jsonb_build_object('target_type',p_target_type,'target_id',p_target_id));

  return jsonb_build_object('ok',true,'report_id',v_report_id,'status','open');
end
$function$;

create or replace function public.report_content(
  p_target_type text,
  p_target_id uuid,
  p_reason_code text,
  p_details text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.report_content(p_target_type,p_target_id,p_reason_code,p_details);
$function$;

create or replace function app_private.admin_resolve_moderation_report(
  p_report_id uuid,
  p_action text,
  p_reason_code text,
  p_public_note text default null,
  p_private_note text default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  v_report public.moderation_reports%rowtype;
  v_action_id uuid;
begin
  if v_admin is null or not app_private.has_admin_permission('moderation.manage') then raise exception 'admin_permission_required'; end if;
  if p_action not in ('allow','limit','remove','warn','restrict','escalate') then raise exception 'invalid_action'; end if;
  if char_length(trim(p_reason_code)) not between 2 and 80 then raise exception 'invalid_reason'; end if;

  select * into v_report from public.moderation_reports where id=p_report_id for update;
  if not found then raise exception 'report_not_found'; end if;
  if v_report.status in ('resolved','closed') then raise exception 'report_already_closed'; end if;

  insert into public.moderation_actions(
    report_id,target_type,target_id,action,actor_admin_id,reason_code,
    public_note,private_note,expires_at
  ) values (
    v_report.id,v_report.target_type,v_report.target_id,p_action,v_admin,trim(p_reason_code),
    nullif(trim(coalesce(p_public_note,'')),''),nullif(trim(coalesce(p_private_note,'')),''),p_expires_at
  ) returning id into v_action_id;

  update public.moderation_reports
  set status=case when p_action='escalate' then 'escalated'::public.case_status else 'resolved'::public.case_status end,
      assigned_admin_id=v_admin,
      updated_at=now()
  where id=v_report.id;

  insert into public.admin_audit_logs(
    actor_id,action,target_type,target_id,before_redacted,after_redacted,reason
  ) values (
    v_admin,'moderation.report.resolve','moderation_report',v_report.id,
    jsonb_build_object('status',v_report.status,'target_type',v_report.target_type),
    jsonb_build_object('status',case when p_action='escalate' then 'escalated' else 'resolved' end,'action',p_action,'action_id',v_action_id),
    trim(p_reason_code)
  );

  insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
  values('moderation_report',v_report.id,'moderation_report.resolved',jsonb_build_object('action',p_action,'action_id',v_action_id));

  return jsonb_build_object('ok',true,'report_id',v_report.id,'action_id',v_action_id,'action',p_action);
end
$function$;

create or replace function public.admin_resolve_moderation_report(
  p_report_id uuid,
  p_action text,
  p_reason_code text,
  p_public_note text default null,
  p_private_note text default null,
  p_expires_at timestamptz default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select app_private.admin_resolve_moderation_report(p_report_id,p_action,p_reason_code,p_public_note,p_private_note,p_expires_at);
$function$;

revoke all on function app_private.report_content(text,uuid,text,text) from public,anon;
revoke all on function public.report_content(text,uuid,text,text) from public,anon;
revoke all on function app_private.admin_resolve_moderation_report(uuid,text,text,text,text,timestamptz) from public,anon;
revoke all on function public.admin_resolve_moderation_report(uuid,text,text,text,text,timestamptz) from public,anon;
grant execute on function app_private.report_content(text,uuid,text,text) to authenticated;
grant execute on function public.report_content(text,uuid,text,text) to authenticated;
grant execute on function app_private.admin_resolve_moderation_report(uuid,text,text,text,text,timestamptz) to authenticated;
grant execute on function public.admin_resolve_moderation_report(uuid,text,text,text,text,timestamptz) to authenticated;

commit;
