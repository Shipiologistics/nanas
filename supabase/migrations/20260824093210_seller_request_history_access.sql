-- Sellers retain access to the safe request summary after the marketplace
-- request closes only when they submitted a quote or became the booked seller.
drop policy if exists requests_buyer_market_admin_select on public.booking_requests;

create policy requests_buyer_market_admin_select
  on public.booking_requests
  for select
  to authenticated
  using (
    buyer_id = (select auth.uid())
    or (
      app_private.has_role('seller')
      and (
        status in ('requested', 'offered')
        or exists (
          select 1
          from public.booking_quotes q
          where q.request_id = booking_requests.id
            and q.seller_id = (select auth.uid())
        )
        or exists (
          select 1
          from public.bookings b
          where b.request_id = booking_requests.id
            and b.seller_id = (select auth.uid())
        )
      )
    )
    or app_private.has_admin_permission('bookings.read')
  );
