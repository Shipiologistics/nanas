begin;

create table public.booking_visit_updates(
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id) on delete cascade,
 provider_id uuid not null references public.profiles(id),
 update_type text not null check(update_type in('arrival','activity','meal','wellbeing','departure','other')),
 note text not null check(char_length(note) between 2 and 500),
 occurred_at timestamptz not null default now(),
 client_nonce uuid not null,
 created_at timestamptz not null default now(),
 unique(provider_id,client_nonce)
);
create index booking_visit_updates_timeline_idx on public.booking_visit_updates(booking_id,occurred_at desc,id desc);
alter table public.booking_visit_updates enable row level security;
create policy booking_visit_updates_parties_admin on public.booking_visit_updates for select to authenticated
using(app_private.is_booking_party(booking_id) or app_private.has_admin_permission('bookings.read'));
grant select on public.booking_visit_updates to authenticated;
revoke insert,update,delete on public.booking_visit_updates from anon,authenticated;
create trigger booking_visit_updates_immutable before update or delete on public.booking_visit_updates
for each row execute function app_private.prevent_app_mutation();

create function app_private.add_booking_visit_update(
 p_booking_id uuid,p_update_type text,p_note text,p_client_nonce uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_booking public.bookings%rowtype;v_profile public.profiles%rowtype;v_existing public.booking_visit_updates%rowtype;v_id uuid;
begin
 if v_user is null then raise exception 'authentication_required'; end if;
 if p_booking_id is null or p_client_nonce is null then raise exception 'invalid_visit_update'; end if;
 if p_update_type is null or p_update_type not in('arrival','activity','meal','wellbeing','departure','other') then raise exception 'invalid_visit_update_type'; end if;
 if char_length(trim(coalesce(p_note,''))) not between 2 and 500 then raise exception 'invalid_visit_update_note'; end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found or v_booking.seller_id<>v_user then raise exception 'booking_unavailable'; end if;
 if v_booking.status<>'in_progress' then raise exception 'visit_update_not_allowed'; end if;
 select * into v_profile from public.profiles where id=v_user for share;
 if not found or v_profile.deleted_at is not null or v_profile.account_status not in('active','restricted') then raise exception 'visit_update_not_allowed'; end if;
 select * into v_existing from public.booking_visit_updates where provider_id=v_user and client_nonce=p_client_nonce;
 if found then
  if v_existing.booking_id<>p_booking_id or v_existing.update_type<>p_update_type or v_existing.note<>trim(p_note) then raise exception 'idempotency_key_reused'; end if;
  return jsonb_build_object('ok',true,'visit_update_id',v_existing.id,'booking_id',p_booking_id,'replayed',true,'occurred_at',v_existing.occurred_at);
 end if;
 insert into public.booking_visit_updates(booking_id,provider_id,update_type,note,client_nonce)
 values(p_booking_id,v_user,p_update_type,trim(p_note),p_client_nonce) returning id into v_id;
 insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
 values('booking',p_booking_id,'booking.visit_update',jsonb_build_object('visit_update_id',v_id,'update_type',p_update_type,'provider_id',v_user));
 insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
 values(v_booking.buyer_id,'visit_update','booking','normal',jsonb_build_object('booking_id',p_booking_id,'visit_update_id',v_id,'update_type',p_update_type),'visit_update:'||v_id::text||':'||v_booking.buyer_id::text)
 on conflict(dedupe_key) do nothing;
 return jsonb_build_object('ok',true,'visit_update_id',v_id,'booking_id',p_booking_id,'replayed',false,
  'occurred_at',(select occurred_at from public.booking_visit_updates where id=v_id));
end $$;

create function public.add_booking_visit_update(p_booking_id uuid,p_update_type text,p_note text,p_client_nonce uuid)
returns jsonb language sql security invoker set search_path=''
as $$select app_private.add_booking_visit_update($1,$2,$3,$4)$$;

create function app_private.booking_visit_update_page(
 p_booking_id uuid,p_before_at timestamptz default null,p_before_id uuid default null,p_limit integer default 50
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_items jsonb;v_last jsonb;
begin
 if v_user is null then raise exception 'authentication_required'; end if;
 if p_limit is null or p_limit not between 1 and 50 then raise exception 'invalid_visit_update_limit'; end if;
 if (p_before_at is null)<>(p_before_id is null) then raise exception 'invalid_visit_update_cursor'; end if;
 if not app_private.is_booking_party(p_booking_id) and not app_private.has_admin_permission('bookings.read') then raise exception 'booking_unavailable'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'booking_id',u.booking_id,'provider_id',u.provider_id,
  'update_type',u.update_type,'note',u.note,'occurred_at',u.occurred_at) order by u.occurred_at desc,u.id desc),'[]'::jsonb)
 into v_items from (select * from public.booking_visit_updates where booking_id=p_booking_id
  and (p_before_at is null or (occurred_at,id)<(p_before_at,p_before_id)) order by occurred_at desc,id desc limit p_limit) u;
 v_last:=v_items->(jsonb_array_length(v_items)-1);
 return jsonb_build_object('ok',true,'booking_id',p_booking_id,'updates',v_items,
  'next_before_at',case when jsonb_array_length(v_items)=p_limit then v_last->>'occurred_at' else null end,
  'next_before_id',case when jsonb_array_length(v_items)=p_limit then v_last->>'id' else null end);
end $$;

create function public.booking_visit_update_page(
 p_booking_id uuid,p_before_at timestamptz default null,p_before_id uuid default null,p_limit integer default 50
)
returns jsonb language sql security invoker set search_path=''
as $$select app_private.booking_visit_update_page($1,$2,$3,$4)$$;

create or replace function app_private.deliver_in_app_notification(p_outbox_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ declare
  v_item public.notification_outbox%rowtype; v_role text; v_context text;
  v_conversation uuid; v_booking uuid; v_request uuid; v_link text; v_title text; v_body text;
begin
  select * into v_item from public.notification_outbox where id=p_outbox_id;
  if not found then return; end if;
  if exists(select 1 from public.notification_preferences where user_id=v_item.recipient_id
    and event_category=v_item.category and not in_app) then return; end if;
  v_conversation:=app_private.safe_uuid(v_item.variables_redacted->>'conversation_id');
  v_booking:=app_private.safe_uuid(v_item.variables_redacted->>'booking_id');
  v_request:=app_private.safe_uuid(v_item.variables_redacted->>'request_id');
  if v_conversation is not null then
    select role::text into v_context from public.conversation_members where conversation_id=v_conversation and user_id=v_item.recipient_id and left_at is null;
  elsif v_booking is not null then
    select case when buyer_id=v_item.recipient_id then 'buyer' when seller_id=v_item.recipient_id then 'seller' end into v_context from public.bookings where id=v_booking;
  end if;
  select role::text into v_role from public.user_roles where user_id=v_item.recipient_id and revoked_at is null
    order by case when role::text=v_context then 0 when v_item.template_key like 'verification_%' and role::text='seller' then 1
      when v_item.template_key='quote_received' and role::text='buyer' then 1 when role::text='buyer' then 2 when role::text='seller' then 3 else 4 end limit 1;
  v_link:=case when v_role in('buyer','seller','admin') then '/app/'||v_role else '/auth' end;
  if v_link<>'/auth' then v_link:=v_link||case when v_conversation is not null then '/messages'||case when v_role='admin' then '' else '/'||v_conversation::text end
    when v_booking is not null then '/bookings' when v_role='admin' then '/notifications'
    when v_item.template_key in('verification_decision','verification_submitted') then case when v_role='seller' then '/kyc' else '/account' end
    when v_item.template_key='quote_received' then '/quotes' when v_request is not null then case when v_role='seller' then '/requests' else '/care-requests' end else '/notifications' end; end if;
  v_title:=case v_item.category when 'booking' then 'Nanas booking update' when 'messages' then 'New Nanas message' when 'payments' then 'Nanas payment update' when 'account' then 'Nanas account update' else 'Nanas update' end;
  v_body:=case v_item.template_key when 'new_message' then 'You have a new secure message.' when 'quote_received' then 'You received a new quote for your care request.'
    when 'booking_confirmed' then 'A Nanas care booking has been confirmed.' when 'booking_status_changed' then 'The status of your care booking changed.'
    when 'visit_update' then 'Your provider shared a private visit update.' when 'payment_captured' then 'A payment update is available in your booking.'
    when 'verification_decision' then 'Your provider verification has been updated.' else 'There is a new update in your Nanas account.' end;
  insert into public.notifications(id,recipient_id,event_type,category,title,body,deep_link,related_type,related_id)
    values(v_item.id,v_item.recipient_id,v_item.template_key,v_item.category,v_title,v_body,v_link,
      case when v_booking is not null then 'booking' when v_request is not null then 'booking_request' when v_conversation is not null then 'conversation' end,coalesce(v_booking,v_request,v_conversation)) on conflict(id) do nothing;
  insert into public.notification_deliveries(id,outbox_id,notification_id,channel,vendor,status,attempts,delivered_at)
    values(v_item.id,v_item.id,v_item.id,'in_app','nanas-database','delivered',1,now()) on conflict(id) do nothing;
end $$;

revoke all on function app_private.add_booking_visit_update(uuid,text,text,uuid),public.add_booking_visit_update(uuid,text,text,uuid),
 app_private.booking_visit_update_page(uuid,timestamptz,uuid,integer),public.booking_visit_update_page(uuid,timestamptz,uuid,integer) from public,anon;
grant execute on function app_private.add_booking_visit_update(uuid,text,text,uuid),public.add_booking_visit_update(uuid,text,text,uuid),
 app_private.booking_visit_update_page(uuid,timestamptz,uuid,integer),public.booking_visit_update_page(uuid,timestamptz,uuid,integer) to authenticated;
revoke all on function app_private.deliver_in_app_notification(uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
