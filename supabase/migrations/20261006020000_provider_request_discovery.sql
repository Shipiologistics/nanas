begin;

-- Preserve the advertised benefit at publication, not a mutable plan setting.
alter table public.booking_request_publications add column featured_snapshot boolean not null default false;
-- These two seeded plans explicitly advertised priority from their introduction.
-- Unknown legacy/custom plans cannot have their historical benefit reconstructed.
update public.booking_request_publications set featured_snapshot=true where plan_code in ('premium','premium_plus');
create function app_private.snapshot_publication_placement()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_plan public.job_posting_plans%rowtype; begin
  select * into v_plan from public.job_posting_plans where id=new.plan_id for share;
  if not found or v_plan.code<>new.plan_code or v_plan.fee_minor<>new.fee_minor_snapshot
    or v_plan.duration_days<>new.duration_days_snapshot then raise exception 'posting_plan_changed'; end if;
  new.featured_snapshot:=v_plan.featured;
  return new;
end $$;
create trigger publication_placement_snapshot before insert on public.booking_request_publications
for each row execute function app_private.snapshot_publication_placement();
revoke all on function app_private.snapshot_publication_placement() from public,anon,authenticated;

-- A narrow provider-only projection: no address, recipient, intake, payment,
-- other provider identities or quote contents. Identity is never supplied by caller.
create or replace function public.provider_request_feed(
  p_sort text default 'recommended', p_query text default '', p_service text default 'all',
  p_area text default 'all', p_page integer default 0, p_page_size integer default 20,
  p_request_id uuid default null
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
    join public.services s on s.id=r.service_id and s.active
    join public.service_areas a on a.id=r.service_area_id and a.active
    left join public.booking_request_publications pub on pub.request_id=r.id
    where r.buyer_id<>auth.uid() and r.status in ('requested','offered') and r.desired_start>now()
      and (r.published_until is null or r.published_until>now())
      and (pub.request_id is null or (pub.expires_at>now() and pub.payment_status<>'refunded'))
      and (p_request_id is null or r.id=p_request_id)
      and exists(select 1 from public.seller_profiles sp
        join public.seller_services ss on ss.seller_id=sp.user_id and ss.service_id=r.service_id and ss.active
        join public.seller_service_areas sa on sa.seller_id=sp.user_id and sa.service_area_id=r.service_area_id and sa.active
        where sp.user_id=auth.uid() and sp.status='approved' and sp.profile_published_at is not null)
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
revoke all on function public.provider_request_feed(text,text,text,text,integer,integer,uuid) from public,anon;
grant execute on function public.provider_request_feed(text,text,text,text,integer,integer,uuid) to authenticated;
commit;
