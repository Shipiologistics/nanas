create or replace function app_private.enforce_free_posting_allowance()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare v_allowance integer; v_request_count integer;
begin
  if new.fee_minor_snapshot <> 0 then return new; end if;
  select free_post_allowance into v_allowance from public.job_posting_plans where id=new.plan_id;
  select count(*)::integer into v_request_count from public.booking_requests where buyer_id=new.buyer_id;
  if v_request_count > coalesce(v_allowance,0) then raise exception 'free_posting_allowance_used'; end if;
  return new;
end; $$;

drop trigger if exists booking_publications_enforce_free_allowance on public.booking_request_publications;
create trigger booking_publications_enforce_free_allowance
before insert on public.booking_request_publications
for each row execute function app_private.enforce_free_posting_allowance();

revoke execute on function app_private.enforce_free_posting_allowance() from public,anon,authenticated;
