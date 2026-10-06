begin;

-- Evaluate related records under one narrowly scoped predicate to avoid
-- recursive request/quote RLS queries. The identity always comes from auth.uid.
create or replace function app_private.can_view_seller_request(p_request_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select app_private.has_role('seller') and exists (
    select 1 from public.booking_requests r
    where r.id=p_request_id and (
      exists(select 1 from public.booking_quotes q where q.request_id=r.id and q.seller_id=(select auth.uid()))
      or exists(select 1 from public.bookings b where b.request_id=r.id and b.seller_id=(select auth.uid()))
      or (
        r.status in ('requested','offered') and r.desired_start > now()
        and (r.published_until is null or r.published_until > now())
        and exists (
          select 1 from public.seller_profiles sp
          join public.seller_services ss on ss.seller_id=sp.user_id and ss.service_id=r.service_id and ss.active
          join public.seller_service_areas sa on sa.seller_id=sp.user_id and sa.service_area_id=r.service_area_id and sa.active
          where sp.user_id=(select auth.uid()) and sp.status='approved' and sp.profile_published_at is not null
        )
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_user_id=r.buyer_id and b.blocked_user_id=(select auth.uid()))
             or (b.blocked_user_id=r.buyer_id and b.blocker_user_id=(select auth.uid()))
        )
      )
    )
  );
$$;
revoke all on function app_private.can_view_seller_request(uuid) from public,anon;
grant execute on function app_private.can_view_seller_request(uuid) to authenticated;

drop policy if exists requests_buyer_market_admin_select on public.booking_requests;
create policy requests_buyer_market_admin_select on public.booking_requests for select to authenticated
using (
  buyer_id=(select auth.uid()) or app_private.can_view_seller_request(id)
  or app_private.has_admin_permission('bookings.read')
);
commit;
