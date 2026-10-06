begin;

create function app_private.validate_booking_request_schedule()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.schedule_kind='recurring' and cardinality(new.weekdays)=0 then raise exception 'recurring_weekday_required'; end if;
 if cardinality(new.weekdays)<>(select count(distinct value)::integer from unnest(new.weekdays) value) then raise exception 'duplicate_schedule_weekday'; end if;
 if (new.specific_start is null)<>(new.specific_end is null) then raise exception 'incomplete_specific_time'; end if;
 if new.specific_start is not null and new.specific_end<=new.specific_start then raise exception 'invalid_specific_time'; end if;
 if new.specific_start is not null and cardinality(new.time_periods)>0 then raise exception 'ambiguous_schedule_time'; end if;
 if new.specific_start is null and cardinality(new.time_periods)=0 then raise exception 'schedule_time_required'; end if;
 return new;
end $$;
create trigger booking_request_schedule_validate before insert or update on public.booking_request_schedules
for each row execute function app_private.validate_booking_request_schedule();

drop policy if exists request_schedules_participants_read on public.booking_request_schedules;
create policy request_schedules_participants_read on public.booking_request_schedules for select to authenticated
using(buyer_id=auth.uid() or app_private.can_view_seller_request(request_id) or app_private.has_admin_permission('bookings.read'));

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
     jsonb_build_object('kind',sch.schedule_kind,'start_date',sch.start_date,'end_date',sch.end_date,
       'flexible_start',sch.flexible_start,'weekdays',sch.weekdays,'time_periods',sch.time_periods,
       'specific_start',sch.specific_start,'specific_end',sch.specific_end,
       'schedule_may_vary',sch.schedule_may_vary,'timezone',sch.timezone) schedule,
     coalesce(pub.featured_snapshot and pub.expires_at>now() and pub.payment_status in ('free','simulated_paid'),false) featured,
     (select count(*) from public.booking_quotes q where q.request_id=r.id) quote_count,
     exists(select 1 from public.booking_quotes q where q.request_id=r.id and q.seller_id=auth.uid()) has_quoted
   from public.booking_requests r
   join public.profiles buyer on buyer.id=r.buyer_id and buyer.account_status='active' and buyer.deleted_at is null
   join public.services s on s.id=r.service_id and s.active
   join public.service_areas a on a.id=r.service_area_id and a.active
   join public.booking_request_schedules sch on sch.request_id=r.id
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

revoke all on function app_private.validate_booking_request_schedule() from public,anon,authenticated;
revoke all on function public.provider_request_feed(text,text,text,text,integer,integer,uuid) from public,anon;
grant execute on function public.provider_request_feed(text,text,text,text,integer,integer,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
