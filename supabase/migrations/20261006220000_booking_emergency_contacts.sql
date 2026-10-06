begin;

alter table public.booking_requests add column emergency_contact_id uuid references public.emergency_contacts(id);
alter table public.bookings add column emergency_contact_id uuid references public.emergency_contacts(id);
create index booking_requests_emergency_contact_idx on public.booking_requests(emergency_contact_id) where emergency_contact_id is not null;
create index bookings_emergency_contact_idx on public.bookings(emergency_contact_id) where emergency_contact_id is not null;

create table public.booking_sensitive_access_logs(
 id uuid primary key default gen_random_uuid(),viewer_id uuid not null references public.profiles(id),
 booking_id uuid not null references public.bookings(id),resource_type text not null check(resource_type='emergency_contact'),
 resource_id uuid not null,fields_accessed text[] not null,created_at timestamptz not null default now()
);
alter table public.booking_sensitive_access_logs enable row level security;
create policy booking_sensitive_access_own_admin on public.booking_sensitive_access_logs for select to authenticated
using(viewer_id=auth.uid() or app_private.has_admin_permission('bookings.read'));
grant select on public.booking_sensitive_access_logs to authenticated;
revoke insert,update,delete on public.booking_sensitive_access_logs from anon,authenticated;
create trigger booking_sensitive_access_immutable before update or delete on public.booking_sensitive_access_logs
for each row execute function app_private.prevent_app_mutation();

create function app_private.bind_request_emergency_contact()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_setting text;v_owner uuid;v_consent timestamptz;
begin
 if tg_op='INSERT' and new.emergency_contact_id is null then
  v_setting:=nullif(current_setting('nanas.emergency_contact_id',true),'');
  if v_setting is not null then new.emergency_contact_id:=v_setting::uuid; end if;
 end if;
 if new.emergency_contact_id is not null then
  select user_id,consent_confirmed_at into v_owner,v_consent from public.emergency_contacts where id=new.emergency_contact_id for share;
  if not found or v_owner<>new.buyer_id then raise exception 'invalid_emergency_contact'; end if;
  if v_consent is null then raise exception 'emergency_contact_consent_required'; end if;
 end if;
 return new;
end $$;
revoke all on function app_private.bind_request_emergency_contact() from public,anon,authenticated;
create trigger booking_requests_emergency_contact_guard before insert or update of buyer_id,emergency_contact_id
on public.booking_requests for each row execute function app_private.bind_request_emergency_contact();

create function app_private.bind_booking_emergency_contact()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_contact uuid;v_buyer uuid;v_owner uuid;
begin
 if new.request_id is not null then
  select buyer_id,emergency_contact_id into v_buyer,v_contact from public.booking_requests where id=new.request_id for share;
  if not found or v_buyer<>new.buyer_id then raise exception 'invalid_booking_request'; end if;
  if new.emergency_contact_id is not null and new.emergency_contact_id is distinct from v_contact then raise exception 'emergency_contact_mismatch'; end if;
  new.emergency_contact_id:=v_contact;
 end if;
 if new.emergency_contact_id is not null then
  select user_id into v_owner from public.emergency_contacts where id=new.emergency_contact_id;
  if not found or v_owner<>new.buyer_id then raise exception 'invalid_emergency_contact'; end if;
 end if;
 return new;
end $$;
revoke all on function app_private.bind_booking_emergency_contact() from public,anon,authenticated;
create trigger bookings_emergency_contact_guard before insert or update of buyer_id,request_id,emergency_contact_id
on public.bookings for each row execute function app_private.bind_booking_emergency_contact();

create or replace function public.create_care_request(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $$
begin
 perform set_config('nanas.emergency_contact_id',coalesce(p_payload->>'emergency_contact_id',''),true);
 return app_private.create_care_request(p_payload);
end $$;

create function app_private.upsert_emergency_contact(
 p_contact_id uuid,p_name text,p_phone_e164 text,p_relationship text,p_priority smallint,p_consent_confirmed boolean
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_id uuid:=coalesce(p_contact_id,gen_random_uuid());
begin
 if v_user is null or not app_private.has_role('buyer') then raise exception 'buyer_required'; end if;
 if char_length(trim(coalesce(p_name,''))) not between 2 and 80 then raise exception 'invalid_contact_name'; end if;
 if trim(coalesce(p_phone_e164,''))!~'^\+[1-9][0-9]{7,14}$' then raise exception 'invalid_contact_phone'; end if;
 if char_length(trim(coalesce(p_relationship,''))) not between 2 and 80 then raise exception 'invalid_contact_relationship'; end if;
 if p_priority is null or p_priority not between 1 and 10 then raise exception 'invalid_contact_priority'; end if;
 if p_consent_confirmed is distinct from true then raise exception 'emergency_contact_consent_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('emergency-contacts:'||v_user::text,0));
 if p_contact_id is null then
  insert into public.emergency_contacts(id,user_id,name,phone_e164,relationship,consent_confirmed_at,priority)
  values(v_id,v_user,trim(p_name),trim(p_phone_e164),trim(p_relationship),now(),p_priority);
 else
  update public.emergency_contacts set name=trim(p_name),phone_e164=trim(p_phone_e164),relationship=trim(p_relationship),
   consent_confirmed_at=now(),priority=p_priority,updated_at=now() where id=p_contact_id and user_id=v_user;
  if not found then raise exception 'emergency_contact_not_found'; end if;
 end if;
 return jsonb_build_object('ok',true,'contact_id',v_id,'consent_confirmed',true);
end $$;

create function public.upsert_emergency_contact(
 p_contact_id uuid,p_name text,p_phone_e164 text,p_relationship text,p_priority smallint,p_consent_confirmed boolean
)
returns jsonb language sql security invoker set search_path=''
as $$select app_private.upsert_emergency_contact($1,$2,$3,$4,$5,$6)$$;

create function app_private.revoke_emergency_contact(p_contact_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null or not app_private.has_role('buyer') then raise exception 'buyer_required'; end if;
 update public.emergency_contacts set consent_confirmed_at=null,updated_at=now() where id=p_contact_id and user_id=v_user;
 if not found then raise exception 'emergency_contact_not_found'; end if;
 return jsonb_build_object('ok',true,'contact_id',p_contact_id,'consent_confirmed',false);
end $$;

create function public.revoke_emergency_contact(p_contact_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$select app_private.revoke_emergency_contact($1)$$;

create function app_private.booking_emergency_contact(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_booking public.bookings%rowtype;v_contact public.emergency_contacts%rowtype;v_access uuid;
begin
 if v_user is null then raise exception 'authentication_required'; end if;
 select * into v_booking from public.bookings where id=p_booking_id;
 if not found or v_user not in(v_booking.buyer_id,v_booking.seller_id) then raise exception 'booking_unavailable'; end if;
 if v_user=v_booking.seller_id and v_booking.status not in('confirmed','in_progress','completion_pending') then raise exception 'emergency_contact_unavailable'; end if;
 if v_booking.emergency_contact_id is null then return jsonb_build_object('ok',true,'booking_id',p_booking_id,'configured',false); end if;
 select * into v_contact from public.emergency_contacts where id=v_booking.emergency_contact_id and user_id=v_booking.buyer_id and consent_confirmed_at is not null;
 if not found then return jsonb_build_object('ok',true,'booking_id',p_booking_id,'configured',false); end if;
 insert into public.booking_sensitive_access_logs(viewer_id,booking_id,resource_type,resource_id,fields_accessed)
 values(v_user,p_booking_id,'emergency_contact',v_contact.id,array['name','phone_e164','relationship']) returning id into v_access;
 return jsonb_build_object('ok',true,'booking_id',p_booking_id,'configured',true,'access_log_id',v_access,
  'contact',jsonb_build_object('id',v_contact.id,'name',v_contact.name,'phone_e164',v_contact.phone_e164,'relationship',v_contact.relationship));
end $$;

create function public.booking_emergency_contact(p_booking_id uuid)
returns jsonb language sql security invoker set search_path=''
as $$select app_private.booking_emergency_contact($1)$$;

revoke all on function public.create_care_request(jsonb),
 app_private.upsert_emergency_contact(uuid,text,text,text,smallint,boolean),public.upsert_emergency_contact(uuid,text,text,text,smallint,boolean),
 app_private.revoke_emergency_contact(uuid),public.revoke_emergency_contact(uuid),
 app_private.booking_emergency_contact(uuid),public.booking_emergency_contact(uuid) from public,anon;
grant execute on function public.create_care_request(jsonb),
 app_private.upsert_emergency_contact(uuid,text,text,text,smallint,boolean),public.upsert_emergency_contact(uuid,text,text,text,smallint,boolean),
 app_private.revoke_emergency_contact(uuid),public.revoke_emergency_contact(uuid),
 app_private.booking_emergency_contact(uuid),public.booking_emergency_contact(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
