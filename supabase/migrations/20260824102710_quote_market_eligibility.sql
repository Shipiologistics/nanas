begin;

create or replace function app_private.validate_booking_quote_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_area_id uuid;
begin
  select service_area_id into v_area_id
  from public.booking_requests
  where id=new.request_id and buyer_id=new.buyer_id and service_id=new.service_id;
  if not found then raise exception 'request_quote_mismatch'; end if;

  if not exists (
    select 1
    from public.seller_profiles sp
    join public.seller_services ss on ss.seller_id=sp.user_id and ss.service_id=new.service_id and ss.active
    join public.seller_service_areas ssa on ssa.seller_id=sp.user_id and ssa.service_area_id=v_area_id and ssa.active
    where sp.user_id=new.seller_id and sp.status='approved' and sp.profile_published_at is not null
  ) then raise exception 'seller_not_eligible_for_service_area'; end if;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_user_id=new.buyer_id and b.blocked_user_id=new.seller_id)
       or (b.blocker_user_id=new.seller_id and b.blocked_user_id=new.buyer_id)
  ) then raise exception 'interaction_blocked'; end if;
  return new;
end
$function$;

drop trigger if exists booking_quotes_validate_eligibility on public.booking_quotes;
create trigger booking_quotes_validate_eligibility
before insert on public.booking_quotes
for each row execute function app_private.validate_booking_quote_eligibility();

drop policy if exists requests_buyer_market_admin_select on public.booking_requests;
create policy requests_buyer_market_admin_select
  on public.booking_requests
  for select
  to authenticated
  using (
    buyer_id=(select auth.uid())
    or (
      app_private.has_role('seller')
      and (
        (
          status in ('requested','offered')
          and exists (
            select 1
            from public.seller_profiles sp
            join public.seller_services ss on ss.seller_id=sp.user_id and ss.service_id=booking_requests.service_id and ss.active
            join public.seller_service_areas ssa on ssa.seller_id=sp.user_id and ssa.service_area_id=booking_requests.service_area_id and ssa.active
            where sp.user_id=(select auth.uid())
              and sp.status='approved'
              and sp.profile_published_at is not null
          )
          and not exists (
            select 1 from public.blocks blocked
            where (blocked.blocker_user_id=booking_requests.buyer_id and blocked.blocked_user_id=(select auth.uid()))
               or (blocked.blocker_user_id=(select auth.uid()) and blocked.blocked_user_id=booking_requests.buyer_id)
          )
        )
        or exists (
          select 1 from public.booking_quotes q
          where q.request_id=booking_requests.id and q.seller_id=(select auth.uid())
        )
        or exists (
          select 1 from public.bookings booked
          where booked.request_id=booking_requests.id and booked.seller_id=(select auth.uid())
        )
      )
    )
    or app_private.has_admin_permission('bookings.read')
  );

revoke all on function app_private.validate_booking_quote_eligibility() from public,anon,authenticated;

commit;
