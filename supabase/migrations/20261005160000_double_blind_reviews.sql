begin;

drop policy if exists reviews_public on public.reviews;
create policy reviews_public on public.reviews for select to anon,authenticated
using (status='published' or author_id=(select auth.uid()) or app_private.has_admin_permission('moderation.read'));

-- Keep aggregates correct when a review is published, moderated or deleted,
-- including changes made by the maintenance/admin services.
create or replace function app_private.refresh_review_ratings()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_old uuid; v_new uuid;
begin
  if tg_op <> 'INSERT' then v_old := old.subject_id; end if;
  if tg_op <> 'DELETE' then v_new := new.subject_id; end if;
  perform user_id from public.seller_profiles where user_id in (v_old,v_new) order by user_id for update;
  update public.seller_profiles sp set
    rating_average=coalesce((select round(avg(r.overall_rating)::numeric,2) from public.reviews r where r.subject_id=sp.user_id and r.status='published'),0),
    rating_count=(select count(*)::integer from public.reviews r where r.subject_id=sp.user_id and r.status='published')
  where sp.user_id in (v_old,v_new);
  return null;
end;
$$;
revoke all on function app_private.refresh_review_ratings() from public,anon,authenticated;
create trigger reviews_refresh_ratings after insert or update or delete on public.reviews
for each row execute function app_private.refresh_review_ratings();

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
  if not found or v_booking.status <> 'completed' or v_user not in (v_booking.buyer_id,v_booking.seller_id) then raise exception 'review_not_eligible'; end if;
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

-- Worker-only bounded sweep, sharing the same booking lock and seven-day
-- completion-based window as submission. No client may force publication.
create or replace function public.publish_due_reviews(p_limit integer default 100)
returns integer language plpgsql security definer set search_path=''
as $$
declare v_booking_id uuid; v_count integer := 0; v_updated integer;
begin
  if p_limit is null or p_limit not between 1 and 1000 then raise exception 'invalid_limit'; end if;
  for v_booking_id in
    select b.id from public.bookings b
    where b.completed_at <= now()-interval '7 days'
      and exists(select 1 from public.reviews r where r.booking_id=b.id and r.status='pending_peer')
    order by b.completed_at,b.id limit p_limit for update of b skip locked
  loop
    update public.reviews set status='published',published_at=now()
    where booking_id=v_booking_id and status='pending_peer';
    get diagnostics v_updated = row_count;
    v_count := v_count+v_updated;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.publish_due_reviews(integer) from public,anon,authenticated;
grant execute on function public.publish_due_reviews(integer) to service_role;

commit;
