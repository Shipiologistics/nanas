create table public.job_posting_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(name) between 2 and 80),
  description text not null check (char_length(description) between 5 and 500),
  fee_minor bigint not null default 0 check (fee_minor >= 0),
  currency char(3) not null default 'BSD' check (currency = 'BSD'),
  duration_days integer not null check (duration_days between 1 and 365),
  free_post_allowance integer not null default 0 check (free_post_allowance between 0 and 100),
  featured boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.job_posting_plans(code,name,description,fee_minor,duration_days,free_post_allowance,featured,sort_order)
values
  ('free','Free care request','Your first care request, visible to matching approved sellers.',0,7,1,false,10),
  ('premium','Premium care request','Longer visibility with priority placement in matching.',1900,30,0,true,20),
  ('premium_plus','Premium Plus','Maximum visibility duration and featured placement.',3900,45,0,true,30)
on conflict (code) do nothing;

alter table public.booking_requests
  add column rate_min_minor bigint check (rate_min_minor is null or rate_min_minor >= 0),
  add column rate_max_minor bigint check (rate_max_minor is null or rate_max_minor >= 0),
  add column posting_plan_id uuid references public.job_posting_plans(id),
  add column publication_type text not null default 'free' check (publication_type in ('free','premium')),
  add column published_until timestamptz,
  add constraint booking_requests_rate_range check (rate_min_minor is null or rate_max_minor is null or rate_max_minor >= rate_min_minor);

create table public.booking_request_recipients (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.booking_requests(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  private_label text not null check (char_length(private_label) between 1 and 80),
  relationship text not null check (relationship in ('self','child','family_member','other_dependent')),
  birth_month smallint check (birth_month between 1 and 12),
  birth_year smallint check (birth_year between 1900 and extract(year from current_date)::integer),
  expecting boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.booking_request_schedules (
  request_id uuid primary key references public.booking_requests(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  schedule_kind text not null check (schedule_kind in ('recurring','one_time')),
  start_date date not null,
  end_date date,
  flexible_start boolean not null default false,
  weekdays smallint[] not null default '{}'::smallint[],
  time_periods text[] not null default '{}'::text[],
  specific_start time,
  specific_end time,
  schedule_may_vary boolean not null default false,
  timezone text not null default 'America/Nassau',
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  check (time_periods <@ array['morning','afternoon','evening','overnight']::text[]),
  check (specific_end is null or specific_start is not null)
);

create table public.booking_request_publications (
  request_id uuid primary key references public.booking_requests(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.job_posting_plans(id),
  plan_code text not null,
  fee_minor_snapshot bigint not null check (fee_minor_snapshot >= 0),
  currency char(3) not null default 'BSD' check (currency = 'BSD'),
  duration_days_snapshot integer not null check (duration_days_snapshot between 1 and 365),
  payment_status text not null check (payment_status in ('free','simulated_paid','refunded')),
  published_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index booking_request_recipients_request on public.booking_request_recipients(request_id);
create index booking_request_publications_buyer on public.booking_request_publications(buyer_id,published_at desc);
create index booking_requests_publication_queue on public.booking_requests(status,published_until) where status in ('requested','offered');

alter table public.job_posting_plans enable row level security;
alter table public.booking_request_recipients enable row level security;
alter table public.booking_request_schedules enable row level security;
alter table public.booking_request_publications enable row level security;

create policy posting_plans_public_read on public.job_posting_plans
for select to anon,authenticated
using (active or app_private.has_admin_permission('config.manage'));

create policy request_recipients_buyer_admin_read on public.booking_request_recipients
for select to authenticated
using (buyer_id=(select auth.uid()) or app_private.has_admin_permission('bookings.read'));

create policy request_schedules_participants_read on public.booking_request_schedules
for select to authenticated
using (
  buyer_id=(select auth.uid())
  or exists (
    select 1 from public.booking_requests r
    where r.id=request_id
      and r.status in ('requested','offered')
      and app_private.has_role('seller')
  )
  or app_private.has_admin_permission('bookings.read')
);

create policy request_publications_buyer_admin_read on public.booking_request_publications
for select to authenticated
using (buyer_id=(select auth.uid()) or app_private.has_admin_permission('finance.read'));

revoke all on public.job_posting_plans,public.booking_request_recipients,public.booking_request_schedules,public.booking_request_publications from anon,authenticated;
grant select on public.job_posting_plans to anon,authenticated;
grant select on public.booking_request_recipients,public.booking_request_schedules,public.booking_request_publications to authenticated;

create or replace function app_private.create_care_request(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_request uuid := gen_random_uuid();
  v_member uuid;
  v_address uuid;
  v_service uuid;
  v_area uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_mode public.booking_mode;
  v_summary text;
  v_budget bigint;
  v_rate_min bigint;
  v_rate_max bigint;
  v_plan public.job_posting_plans%rowtype;
  v_free_used integer;
  v_schedule jsonb := coalesce(p_payload->'schedule','{}'::jsonb);
  v_address_payload jsonb := coalesce(p_payload->'address','{}'::jsonb);
  v_recipient jsonb;
  v_publication_type text;
begin
  if v_user is null or not app_private.has_role('buyer') then raise exception 'buyer_required'; end if;

  v_member := nullif(p_payload->>'household_member_id','')::uuid;
  v_address := nullif(p_payload->>'address_id','')::uuid;
  v_service := (p_payload->>'service_id')::uuid;
  v_area := (p_payload->>'service_area_id')::uuid;
  v_start := (p_payload->>'desired_start')::timestamptz;
  v_end := (p_payload->>'desired_end')::timestamptz;
  v_mode := coalesce((p_payload->>'mode')::public.booking_mode,'scheduled');
  v_summary := trim(p_payload->>'care_summary');
  v_budget := nullif(p_payload->>'budget_minor','')::bigint;
  v_rate_min := nullif(p_payload->>'rate_min_minor','')::bigint;
  v_rate_max := nullif(p_payload->>'rate_max_minor','')::bigint;

  select * into v_plan
  from public.job_posting_plans
  where code=coalesce(nullif(p_payload->>'posting_plan_code',''),'free') and active;
  if v_plan.id is null then raise exception 'posting_plan_unavailable'; end if;

  select count(*)::integer into v_free_used
  from public.booking_request_publications
  where buyer_id=v_user and fee_minor_snapshot=0;
  if v_plan.fee_minor=0 and v_free_used>=v_plan.free_post_allowance then
    raise exception 'free_posting_allowance_used';
  end if;
  if v_plan.fee_minor>0 and coalesce((p_payload->>'simulated_payment_confirmed')::boolean,false)=false then
    raise exception 'posting_payment_required';
  end if;

  if v_end<=v_start or v_start<now()-interval '5 minutes' or char_length(v_summary) not between 10 and 1200 then raise exception 'invalid_request'; end if;
  if v_rate_min is not null and v_rate_max is not null and v_rate_max<v_rate_min then raise exception 'invalid_rate_range'; end if;
  if v_member is not null and not exists(select 1 from public.household_members hm join public.households h on h.id=hm.household_id where hm.id=v_member and h.owner_user_id=v_user) then raise exception 'invalid_care_recipient'; end if;
  if not exists(select 1 from public.services s join public.service_areas a on a.id=v_area where s.id=v_service and s.active and a.active) then raise exception 'service_unavailable'; end if;

  if v_address is not null and not exists(select 1 from public.addresses where id=v_address and owner_user_id=v_user and deleted_at is null) then raise exception 'invalid_address'; end if;
  if v_address is null and nullif(v_address_payload->>'line1','') is not null then
    if not exists(select 1 from public.islands i where i.id=(v_address_payload->>'island_id')::uuid and i.active) then raise exception 'invalid_island'; end if;
    insert into public.addresses(owner_user_id,label,line1_private,line2_private,locality,island_id,postal_code,access_notes_private)
    values(v_user,left(coalesce(nullif(v_address_payload->>'label',''),'Care location'),50),trim(v_address_payload->>'line1'),nullif(trim(v_address_payload->>'line2'),''),trim(v_address_payload->>'locality'),(v_address_payload->>'island_id')::uuid,nullif(trim(v_address_payload->>'postal_code'),''),nullif(left(trim(v_address_payload->>'access_notes'),1000),''))
    returning id into v_address;
  end if;
  if v_address is null then raise exception 'care_address_required'; end if;

  v_publication_type := case when v_plan.fee_minor=0 then 'free' else 'premium' end;
  insert into public.booking_requests(id,buyer_id,household_member_id,address_id,service_id,service_area_id,mode,desired_start,desired_end,care_summary,budget_minor,rate_min_minor,rate_max_minor,posting_plan_id,publication_type,published_until,expires_at)
  values(v_request,v_user,v_member,v_address,v_service,v_area,v_mode,v_start,v_end,v_summary,v_budget,v_rate_min,v_rate_max,v_plan.id,v_publication_type,now()+make_interval(days=>v_plan.duration_days),now()+make_interval(days=>v_plan.duration_days));

  for v_recipient in select value from jsonb_array_elements(coalesce(p_payload->'recipients','[]'::jsonb)) loop
    insert into public.booking_request_recipients(request_id,buyer_id,private_label,relationship,birth_month,birth_year,expecting)
    values(v_request,v_user,left(trim(v_recipient->>'label'),80),coalesce(nullif(v_recipient->>'relationship',''),'family_member'),nullif(v_recipient->>'birth_month','')::smallint,nullif(v_recipient->>'birth_year','')::smallint,coalesce((v_recipient->>'expecting')::boolean,false));
  end loop;

  insert into public.booking_request_schedules(request_id,buyer_id,schedule_kind,start_date,end_date,flexible_start,weekdays,time_periods,specific_start,specific_end,schedule_may_vary)
  values(
    v_request,v_user,coalesce(nullif(v_schedule->>'kind',''),'one_time'),
    coalesce(nullif(v_schedule->>'start_date','')::date,(v_start at time zone 'America/Nassau')::date),
    nullif(v_schedule->>'end_date','')::date,
    coalesce((v_schedule->>'flexible_start')::boolean,false),
    coalesce(array(select jsonb_array_elements_text(coalesce(v_schedule->'weekdays','[]'::jsonb))::smallint),'{}'::smallint[]),
    coalesce(array(select jsonb_array_elements_text(coalesce(v_schedule->'time_periods','[]'::jsonb))),'{}'::text[]),
    nullif(v_schedule->>'specific_start','')::time,
    nullif(v_schedule->>'specific_end','')::time,
    coalesce((v_schedule->>'schedule_may_vary')::boolean,false)
  );

  insert into public.booking_request_private(request_id,buyer_id,care_requirements_private,access_notes_private)
  values(v_request,v_user,coalesce(p_payload->'care_requirements','{}'::jsonb),left(p_payload->>'access_notes',1000));

  insert into public.booking_request_publications(request_id,buyer_id,plan_id,plan_code,fee_minor_snapshot,duration_days_snapshot,payment_status,expires_at)
  values(v_request,v_user,v_plan.id,v_plan.code,v_plan.fee_minor,v_plan.duration_days,case when v_plan.fee_minor=0 then 'free' else 'simulated_paid' end,now()+make_interval(days=>v_plan.duration_days));

  insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
  values('booking_request',v_request,'care_request.created',jsonb_build_object('service_id',v_service,'service_area_id',v_area,'plan_code',v_plan.code,'schedule_kind',v_schedule->>'kind'));
  return jsonb_build_object('ok',true,'request_id',v_request,'status','requested','plan_code',v_plan.code,'published_until',now()+make_interval(days=>v_plan.duration_days));
exception when invalid_text_representation then raise exception 'invalid_identifier_or_date';
end; $$;

create or replace function public.create_care_request(p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select app_private.create_care_request(p_payload); $$;

create or replace function app_private.admin_upsert_job_posting_plan(
  p_plan_id uuid,
  p_code text,
  p_name text,
  p_description text,
  p_fee_minor bigint,
  p_duration_days integer,
  p_free_post_allowance integer,
  p_featured boolean,
  p_active boolean,
  p_reason text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid := (select auth.uid()); v_id uuid; v_before jsonb;
begin
  if not app_private.has_admin_permission('config.manage') then raise exception 'admin_permission_required'; end if;
  if char_length(trim(p_reason))<5 then raise exception 'change_reason_required'; end if;
  if p_fee_minor<0 or p_duration_days not between 1 and 365 or p_free_post_allowance not between 0 and 100 then raise exception 'invalid_plan'; end if;
  select jsonb_build_object('code',code,'fee_minor',fee_minor,'duration_days',duration_days,'active',active),id into v_before,v_id
  from public.job_posting_plans where id=p_plan_id or code=p_code limit 1;
  if v_id is null then
    insert into public.job_posting_plans(code,name,description,fee_minor,duration_days,free_post_allowance,featured,active)
    values(trim(p_code),trim(p_name),trim(p_description),p_fee_minor,p_duration_days,p_free_post_allowance,p_featured,p_active) returning id into v_id;
  else
    update public.job_posting_plans set code=trim(p_code),name=trim(p_name),description=trim(p_description),fee_minor=p_fee_minor,duration_days=p_duration_days,free_post_allowance=p_free_post_allowance,featured=p_featured,active=p_active,updated_at=now() where id=v_id;
  end if;
  insert into public.admin_audit_logs(actor_id,action,target_type,target_id,before_redacted,after_redacted,reason)
  values(v_user,'job_posting_plan.updated','job_posting_plan',v_id,v_before,jsonb_build_object('code',trim(p_code),'fee_minor',p_fee_minor,'duration_days',p_duration_days,'active',p_active),trim(p_reason));
  return jsonb_build_object('ok',true,'plan_id',v_id);
end; $$;

create or replace function public.admin_upsert_job_posting_plan(
  p_plan_id uuid,
  p_code text,
  p_name text,
  p_description text,
  p_fee_minor bigint,
  p_duration_days integer,
  p_free_post_allowance integer,
  p_featured boolean,
  p_active boolean,
  p_reason text
) returns jsonb language sql security invoker set search_path=''
as $$ select app_private.admin_upsert_job_posting_plan(p_plan_id,p_code,p_name,p_description,p_fee_minor,p_duration_days,p_free_post_allowance,p_featured,p_active,p_reason); $$;

revoke execute on function app_private.admin_upsert_job_posting_plan(uuid,text,text,text,bigint,integer,integer,boolean,boolean,text) from public,anon;
grant execute on function app_private.admin_upsert_job_posting_plan(uuid,text,text,text,bigint,integer,integer,boolean,boolean,text) to authenticated;
revoke execute on function public.admin_upsert_job_posting_plan(uuid,text,text,text,bigint,integer,integer,boolean,boolean,text) from public,anon;
grant execute on function public.admin_upsert_job_posting_plan(uuid,text,text,text,bigint,integer,integer,boolean,boolean,text) to authenticated;
grant execute on function app_private.create_care_request(jsonb),public.create_care_request(jsonb) to authenticated;
