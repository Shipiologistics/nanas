begin;

-- Use the catalogue's explicit requirements, not a blanket healthcare rule.
-- This predicate returns only eligibility; it never exposes private evidence.
create function app_private.provider_service_eligible(p_provider uuid,p_service uuid,p_area uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists (
   select 1 from public.seller_profiles sp
   join public.profiles p on p.id=sp.user_id and p.account_status='active' and p.deleted_at is null
   join public.user_roles ur on ur.user_id=p.id and ur.role='seller' and ur.revoked_at is null
   join public.seller_services ss on ss.seller_id=sp.user_id and ss.service_id=p_service and ss.active
   join public.services s on s.id=ss.service_id and s.active
   join public.seller_service_areas sa on sa.seller_id=sp.user_id and sa.service_area_id=p_area and sa.active
   join public.service_areas a on a.id=sa.service_area_id and a.active
   where sp.user_id=p_provider and sp.status='approved' and sp.profile_published_at is not null
     and not exists (
       select 1 from unnest(s.required_credential_types) requirement(kind)
       where not exists (
         select 1 from public.seller_credentials c
         where c.seller_id=p_provider and c.credential_type=requirement.kind and c.status='approved'
           and (c.service_id is null or c.service_id=p_service)
           and (c.issue_date is null or c.issue_date<=(now() at time zone 'America/Nassau')::date)
           and (c.expiry_date is null or c.expiry_date>=(now() at time zone 'America/Nassau')::date)
       ) and not (
         -- An identity review is not a nursing licence. Background-check
         -- consent and generic onboarding approval are not completed checks.
         requirement.kind='identity' and exists (
           select 1 from public.verification_cases v where v.seller_id=p_provider
             and v.verification_type in ('identity','Government identity') and v.status='approved'
             and (v.expires_at is null or v.expires_at>now())
         )
       )
     )
 );
$$;
revoke all on function app_private.provider_service_eligible(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function app_private.validate_booking_quote_eligibility()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_request public.booking_requests%rowtype; begin
 select * into v_request from public.booking_requests
 where id=new.request_id and buyer_id=new.buyer_id and service_id=new.service_id;
 if not found then raise exception 'request_quote_mismatch'; end if;
 if not app_private.provider_service_eligible(new.seller_id,new.service_id,v_request.service_area_id)
 then raise exception 'provider_service_requirements_not_met'; end if;
 if exists(select 1 from public.blocks b where
   (b.blocker_user_id=new.buyer_id and b.blocked_user_id=new.seller_id) or
   (b.blocker_user_id=new.seller_id and b.blocked_user_id=new.buyer_id))
 then raise exception 'interaction_blocked'; end if;
 return new;
end $$;
-- A submitted quote cannot switch to another provider/service without checking.
drop trigger booking_quotes_validate_eligibility on public.booking_quotes;
create trigger booking_quotes_validate_eligibility before insert or update of request_id,buyer_id,seller_id,service_id
on public.booking_quotes for each row execute function app_private.validate_booking_quote_eligibility();

-- Recheck at the actual booking insertion, before any capture or ledger write.
-- All checkout adapters must pass this boundary, including future real payments.
-- Historical bookings remain readable/resolvable after a credential expires.
create function app_private.validate_new_booking_provider()
returns trigger language plpgsql security definer set search_path=''
as $$ declare v_request public.booking_requests%rowtype; begin
 select * into v_request from public.booking_requests
 where id=new.request_id and buyer_id=new.buyer_id and service_id=new.service_id;
 if not found or not exists(select 1 from public.booking_quotes q where q.id=new.quote_id
   and q.request_id=new.request_id and q.buyer_id=new.buyer_id and q.seller_id=new.seller_id and q.service_id=new.service_id)
 then raise exception 'request_quote_mismatch'; end if;
 if not app_private.provider_service_eligible(new.seller_id,new.service_id,v_request.service_area_id)
 then raise exception 'provider_service_requirements_not_met'; end if;
 if exists(select 1 from public.blocks b where
   (b.blocker_user_id=new.buyer_id and b.blocked_user_id=new.seller_id) or
   (b.blocker_user_id=new.seller_id and b.blocked_user_id=new.buyer_id))
 then raise exception 'interaction_blocked'; end if;
 return new;
end $$;
create trigger bookings_validate_provider before insert or update of request_id,quote_id,buyer_id,seller_id,service_id
on public.bookings for each row execute function app_private.validate_new_booking_provider();
revoke all on function app_private.validate_new_booking_provider() from public,anon,authenticated;

create or replace function app_private.can_view_seller_request(p_request_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select app_private.has_role('seller') and exists (
   select 1 from public.booking_requests r where r.id=p_request_id and (
     -- Preserve participant history, not permission to create new clinical work.
     exists(select 1 from public.booking_quotes q where q.request_id=r.id and q.seller_id=auth.uid())
     or exists(select 1 from public.bookings b where b.request_id=r.id and b.seller_id=auth.uid())
     or (r.status in ('requested','offered') and r.desired_start>now()
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

notify pgrst,'reload schema';
commit;
