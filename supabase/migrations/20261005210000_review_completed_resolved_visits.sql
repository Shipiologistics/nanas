begin;

-- Resolution does not erase a completed visit. Refund-only cases without
-- a recorded completion remain ineligible for verified reviews.
create or replace function app_private.submit_verified_review(p_booking_id uuid,p_rating smallint,p_body text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_subject uuid;
  v_role public.app_role;
  v_existing public.reviews%rowtype;
  v_review uuid;
  v_publish boolean;
  v_body text := nullif(trim(coalesce(p_body,'')),'');
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found or (v_booking.status not in ('completed','resolved') or v_booking.completed_at is null) or v_user not in (v_booking.buyer_id,v_booking.seller_id) then raise exception 'review_not_eligible'; end if;
  if p_rating is null or p_rating not between 1 and 5 or char_length(coalesce(p_body,''))>2000 then raise exception 'invalid_review'; end if;
  v_subject := case when v_user=v_booking.buyer_id then v_booking.seller_id else v_booking.buyer_id end;
  v_role := case when v_subject=v_booking.seller_id then 'seller'::public.app_role else 'buyer'::public.app_role end;
  select * into v_existing from public.reviews where booking_id=p_booking_id and author_id=v_user and subject_id=v_subject;
  if found then
    if v_existing.overall_rating is distinct from p_rating or v_existing.body is distinct from v_body then raise exception 'review_already_submitted'; end if;
    return jsonb_build_object('ok',true,'review_id',v_existing.id,'published',v_existing.status='published','replayed',true);
  end if;
  v_publish := exists(select 1 from public.reviews where booking_id=p_booking_id and author_id=v_subject)
    or v_booking.completed_at <= now()-interval '7 days';
  insert into public.reviews(booking_id,author_id,subject_id,subject_role,overall_rating,body,status,published_at)
  values(p_booking_id,v_user,v_subject,v_role,p_rating,v_body,
    (case when v_publish then 'published' else 'pending_peer' end)::public.review_status,
    case when v_publish then now() end) returning id into v_review;
  if v_publish then
    update public.reviews set status='published',published_at=coalesce(published_at,now())
    where booking_id=p_booking_id and status='pending_peer';
  end if;
  return jsonb_build_object('ok',true,'review_id',v_review,'published',v_publish);
end;
$$;


commit;

