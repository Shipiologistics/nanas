begin;

-- Account restrictions remove new opportunities, not a participant's existing
-- quoted/booked history. Evaluate under the definer so private profile RLS does
-- not accidentally hide all buyers from an otherwise eligible provider.
create or replace function app_private.can_view_seller_request(p_request_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select app_private.has_role('seller') and exists (
   select 1 from public.booking_requests r where r.id=p_request_id and (
     exists(select 1 from public.booking_quotes q where q.request_id=r.id and q.seller_id=auth.uid())
     or exists(select 1 from public.bookings b where b.request_id=r.id and b.seller_id=auth.uid())
     or (r.status in ('requested','offered') and r.desired_start>now()
       and exists(select 1 from public.profiles p where p.id=r.buyer_id and p.account_status='active' and p.deleted_at is null)
       and (r.published_until is null or r.published_until>now())
       and not exists(select 1 from public.booking_request_publications pub where pub.request_id=r.id
         and (pub.expires_at<=now() or pub.payment_status='refunded'))
       and app_private.provider_service_eligible(auth.uid(),r.service_id,r.service_area_id)
       and not exists(select 1 from public.blocks b where
         (b.blocker_user_id=r.buyer_id and b.blocked_user_id=auth.uid()) or
         (b.blocked_user_id=r.buyer_id and b.blocker_user_id=auth.uid()))
     )
   )
 );
$$;

create or replace function public.provider_request_feed(
 p_sort text default 'recommended',p_query text default '',p_service text default 'all',
 p_area text default 'all',p_page integer default 0,p_page_size integer default 20,p_request_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_result jsonb; begin
 if auth.uid() is null or not app_private.has_role('seller') then raise exception 'provider_required'; end if;
 if p_sort is null or p_sort not in ('recommended','newest','soonest','budget','quotes')
   or p_page is null or p_page<0 or p_page>100000 or p_page_size is null or p_page_size<1 or p_page_size>50
   or p_query is null or length(p_query)>200 or p_service is null or p_area is null then raise exception 'invalid_discovery_filter'; end if;
 with eligible as (
   select r.id,r.buyer_id,r.service_id,r.service_area_id,s.name service,a.name area,r.mode,
     r.desired_start,r.desired_end,r.care_summary,r.budget_minor,r.status,r.created_at,r.published_until,
     coalesce(pub.featured_snapshot and pub.expires_at>now() and pub.payment_status in ('free','simulated_paid'),false) featured,
     (select count(*) from public.booking_quotes q where q.request_id=r.id) quote_count,
     exists(select 1 from public.booking_quotes q where q.request_id=r.id and q.seller_id=auth.uid()) has_quoted
   from public.booking_requests r
   join public.profiles buyer on buyer.id=r.buyer_id and buyer.account_status='active' and buyer.deleted_at is null
   join public.services s on s.id=r.service_id and s.active
   join public.service_areas a on a.id=r.service_area_id and a.active
   left join public.booking_request_publications pub on pub.request_id=r.id
   where r.buyer_id<>auth.uid() and r.status in ('requested','offered') and r.desired_start>now()
     and (r.published_until is null or r.published_until>now())
     and (pub.request_id is null or (pub.expires_at>now() and pub.payment_status<>'refunded'))
     and (p_request_id is null or r.id=p_request_id)
     and app_private.provider_service_eligible(auth.uid(),r.service_id,r.service_area_id)
     and not exists(select 1 from public.blocks b where
       (b.blocker_user_id=r.buyer_id and b.blocked_user_id=auth.uid()) or
       (b.blocked_user_id=r.buyer_id and b.blocker_user_id=auth.uid()))
     and (p_service='all' or s.name=p_service) and (p_area='all' or a.name=p_area)
     and (trim(p_query)='' or strpos(lower(concat_ws(' ',s.name,a.name,r.care_summary,r.mode::text)),lower(trim(p_query)))>0)
 ), ranked as (
   select *,row_number() over(order by
     case when p_sort='recommended' then featured end desc,
     case when p_sort='soonest' then desired_start end asc,
     case when p_sort='budget' then budget_minor end desc nulls last,
     case when p_sort='quotes' then quote_count end asc,
     created_at desc,id asc) position from eligible
 ), page as (select * from ranked order by position offset p_page*p_page_size limit p_page_size)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page)-'position' order by position) from page),'[]'::jsonb),
   'total',(select count(*) from eligible),'page',p_page,'page_size',p_page_size) into v_result;
 return v_result;
end $$;

-- Preserve the narrow existing entry points; no public buyer-status endpoint.
revoke all on function app_private.can_view_seller_request(uuid),public.provider_request_feed(text,text,text,text,integer,integer,uuid) from public,anon;
grant execute on function app_private.can_view_seller_request(uuid),public.provider_request_feed(text,text,text,text,integer,integer,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
