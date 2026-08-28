begin;

create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('SUP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  requester_id uuid not null references public.profiles(id),
  case_type text not null check (case_type in ('account','booking','payment','verification','safety','privacy','appeal','other')),
  priority public.case_priority not null default 'normal',
  status public.case_status not null default 'open',
  subject text not null check (char_length(subject) between 5 and 160),
  details_private text not null check (char_length(details_private) between 10 and 4000),
  booking_id uuid references public.bookings(id),
  payment_intent_id uuid references public.payment_intents(id),
  owner_admin_id uuid references public.profiles(id),
  first_response_due_at timestamptz not null default (now() + interval '4 hours'),
  resolution_due_at timestamptz not null default (now() + interval '2 days'),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_cases_requester_created_idx on public.support_cases(requester_id, created_at desc);
create index support_cases_queue_idx on public.support_cases(status, priority desc, resolution_due_at) where status not in ('resolved','closed');

alter table public.support_cases enable row level security;
create policy support_cases_requester_read on public.support_cases for select to authenticated
using (requester_id = (select auth.uid()) or app_private.has_admin_permission('support.read'));
create policy support_cases_requester_insert on public.support_cases for insert to authenticated
with check (requester_id = (select auth.uid()));

grant select, insert on public.support_cases to authenticated;
revoke update, delete on public.support_cases from anon, authenticated;

create trigger support_cases_updated_at before update on public.support_cases
for each row execute function app_private.set_updated_at();

create or replace function app_private.open_service_dispute(p_booking_id uuid, p_reason_code text, p_summary text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_dispute_id uuid;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if char_length(trim(p_reason_code)) not between 3 and 80 then raise exception 'invalid_reason_code'; end if;
  if char_length(trim(p_summary)) not between 10 and 3000 then raise exception 'invalid_summary'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  if v_user not in (v_booking.buyer_id, v_booking.seller_id) then raise exception 'booking_access_denied'; end if;
  if v_booking.status not in ('confirmed','in_progress','completion_pending','completed','disputed') then raise exception 'dispute_not_allowed'; end if;

  select id into v_dispute_id from public.service_disputes
  where booking_id = p_booking_id and status not in ('resolved','closed') for update;
  if v_dispute_id is null then
    insert into public.service_disputes (booking_id,opened_by,reason_code,summary,priority)
    values (p_booking_id,v_user,left(trim(p_reason_code),80),trim(p_summary),'high') returning id into v_dispute_id;
  end if;

  if v_booking.status <> 'disputed' then
    update public.bookings set status='disputed',blocks_calendar=false,version=version+1 where id=p_booking_id;
    insert into public.booking_status_history (booking_id,from_status,to_status,actor_id,reason_code)
    values (p_booking_id,v_booking.status,'disputed',v_user,'service_dispute_opened');
  end if;
  insert into public.domain_events (aggregate_type,aggregate_id,event_type,payload_redacted)
  values ('service_dispute',v_dispute_id,'service_dispute.opened',jsonb_build_object('booking_id',p_booking_id));
  insert into public.notification_outbox (recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
  values (case when v_user=v_booking.buyer_id then v_booking.seller_id else v_booking.buyer_id end,'service_dispute_opened','safety','high',jsonb_build_object('booking_id',p_booking_id),'dispute:'||v_dispute_id::text||':party')
  on conflict (dedupe_key) do nothing;
  return jsonb_build_object('ok',true,'dispute_id',v_dispute_id,'booking_id',p_booking_id,'status','open');
end;
$$;

create or replace function public.open_service_dispute(p_booking_id uuid, p_reason_code text, p_summary text)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.open_service_dispute(p_booking_id,p_reason_code,p_summary); $$;

create or replace function app_private.create_support_case(p_case_type text,p_subject text,p_details text,p_booking_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid := (select auth.uid()); v_case public.support_cases%rowtype;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_case_type not in ('account','booking','payment','verification','safety','privacy','appeal','other') then raise exception 'invalid_case_type'; end if;
  if char_length(trim(p_subject)) not between 5 and 160 then raise exception 'invalid_subject'; end if;
  if char_length(trim(p_details)) not between 10 and 4000 then raise exception 'invalid_details'; end if;
  if p_booking_id is not null and not app_private.is_booking_party(p_booking_id) then raise exception 'booking_access_denied'; end if;
  insert into public.support_cases(requester_id,case_type,subject,details_private,booking_id,priority)
  values(v_user,p_case_type,trim(p_subject),trim(p_details),p_booking_id,case when p_case_type='safety' then 'high'::public.case_priority else 'normal'::public.case_priority end)
  returning * into v_case;
  insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
  values('support_case',v_case.id,'support_case.opened',jsonb_build_object('reference',v_case.reference,'case_type',v_case.case_type));
  return jsonb_build_object('ok',true,'case_id',v_case.id,'reference',v_case.reference,'status',v_case.status);
end;
$$;

create or replace function public.create_support_case(p_case_type text,p_subject text,p_details text,p_booking_id uuid default null)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.create_support_case(p_case_type,p_subject,p_details,p_booking_id); $$;

create or replace function app_private.generate_session_code(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid := (select auth.uid()); v_booking public.bookings%rowtype; v_code text; v_id uuid; v_until timestamptz;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  if v_user <> v_booking.buyer_id then raise exception 'only_buyer_can_generate_session_code'; end if;
  if v_booking.status not in ('confirmed','in_progress') then raise exception 'session_code_not_allowed'; end if;
  if now() < v_booking.scheduled_start - interval '2 hours' or now() > v_booking.scheduled_end + interval '2 hours' then raise exception 'outside_session_code_window'; end if;
  update public.booking_session_codes set consumed_at=now() where booking_id=p_booking_id and consumed_at is null;
  v_code := lpad(((('x'||encode(gen_random_bytes(4),'hex'))::bit(32)::bigint % 1000000))::text,6,'0');
  v_until := least(now()+interval '15 minutes',v_booking.scheduled_end+interval '2 hours');
  insert into public.booking_session_codes(booking_id,code_digest,valid_from,valid_until,buyer_verified_at)
  values(p_booking_id,crypt(v_code,gen_salt('bf',8)),now(),v_until,now()) returning id into v_id;
  return jsonb_build_object('ok',true,'session_code_id',v_id,'code',v_code,'valid_until',v_until);
end;
$$;

create or replace function public.generate_session_code(p_booking_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.generate_session_code(p_booking_id); $$;

create or replace function app_private.verify_session_code(p_booking_id uuid,p_code text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid := (select auth.uid()); v_booking public.bookings%rowtype; v_code public.booking_session_codes%rowtype; v_ok boolean;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_code !~ '^[0-9]{6}$' then raise exception 'invalid_session_code'; end if;
  select * into v_booking from public.bookings where id=p_booking_id;
  if not found or v_user <> v_booking.seller_id then raise exception 'only_seller_can_verify_session_code'; end if;
  select * into v_code from public.booking_session_codes where booking_id=p_booking_id and consumed_at is null order by created_at desc limit 1 for update;
  if not found or now() not between v_code.valid_from and v_code.valid_until then raise exception 'session_code_expired'; end if;
  v_ok := crypt(p_code,v_code.code_digest)=v_code.code_digest;
  update public.booking_session_codes set attempt_count=attempt_count+1,
    buyer_verified_at=case when v_ok and v_user=v_booking.buyer_id then now() else buyer_verified_at end,
    seller_verified_at=case when v_ok and v_user=v_booking.seller_id then now() else seller_verified_at end
  where id=v_code.id;
  if not v_ok then
    if v_code.attempt_count+1 >= 5 then
      insert into public.risk_signals(user_id,booking_id,signal_type,source,score,evidence_redacted)
      values(v_user,p_booking_id,'session_code_failures','verify_session_code',0.8,jsonb_build_object('attempts',v_code.attempt_count+1));
    end if;
    raise exception 'session_code_incorrect';
  end if;
  return jsonb_build_object('ok',true,'booking_id',p_booking_id,'verified',true);
end;
$$;

create or replace function public.verify_session_code(p_booking_id uuid,p_code text)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.verify_session_code(p_booking_id,p_code); $$;

revoke all on function public.open_service_dispute(uuid,text,text), public.create_support_case(text,text,text,uuid), public.generate_session_code(uuid), public.verify_session_code(uuid,text) from public,anon;
grant execute on function public.open_service_dispute(uuid,text,text), public.create_support_case(text,text,text,uuid), public.generate_session_code(uuid), public.verify_session_code(uuid,text) to authenticated;
grant execute on function app_private.open_service_dispute(uuid,text,text), app_private.create_support_case(text,text,text,uuid), app_private.generate_session_code(uuid), app_private.verify_session_code(uuid,text) to authenticated;

commit;
