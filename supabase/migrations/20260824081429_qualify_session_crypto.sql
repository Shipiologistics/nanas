begin;

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
  v_code := lpad(((('x'||encode(extensions.gen_random_bytes(4),'hex'))::bit(32)::bigint % 1000000))::text,6,'0');
  v_until := least(now()+interval '15 minutes',v_booking.scheduled_end+interval '2 hours');
  insert into public.booking_session_codes(booking_id,code_digest,valid_from,valid_until,buyer_verified_at)
  values(p_booking_id,extensions.crypt(v_code,extensions.gen_salt('bf',8)),now(),v_until,now()) returning id into v_id;
  return jsonb_build_object('ok',true,'session_code_id',v_id,'code',v_code,'valid_until',v_until);
end;
$$;

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
  v_ok := extensions.crypt(p_code,v_code.code_digest)=v_code.code_digest;
  update public.booking_session_codes set attempt_count=attempt_count+1,
    seller_verified_at=case when v_ok then now() else seller_verified_at end
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

commit;
