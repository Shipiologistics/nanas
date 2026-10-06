begin;

-- PostgREST resolves JSON RPC calls by argument name. Earlier hardening
-- wrappers kept only argument types, making these browser operations return
-- PGRST202 even though the functions existed. Keep all authorization and
-- validation in the existing private implementations.
create or replace function public.upsert_household_member(
  p_member_id uuid, p_relationship text, p_display_name text,
  p_date_of_birth date, p_care_notes text, p_active boolean
)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.upsert_household_member($1,$2,$3,$4,$5,$6); $$;

create or replace function public.seller_replace_weekly_availability(
  p_weekdays smallint[], p_local_start time, p_local_end time
)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.seller_replace_weekly_availability($1,$2,$3); $$;

create or replace function public.seller_upsert_service_area(
  p_service_area_id uuid, p_radius_km numeric, p_travel_fee_minor bigint, p_active boolean
)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.seller_upsert_service_area($1,$2,$3,$4); $$;

create or replace function public.seller_upsert_service(
  p_service_id uuid, p_rate_minor bigint, p_rate_max_minor bigint,
  p_service_bio text, p_years_experience integer, p_capabilities text[],
  p_additional_help text[], p_active boolean
)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.seller_upsert_service($1,$2,$3,$4,$5,$6,$7,$8); $$;

create or replace function public.seller_update_public_profile(
  p_display_name text, p_avatar_path text, p_headline text, p_languages text[],
  p_island_id uuid, p_locality text, p_vaccinations text[], p_additional_details text[]
)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.seller_update_public_profile($1,$2,$3,$4,$5,$6,$7,$8); $$;

revoke all on function
  public.upsert_household_member(uuid,text,text,date,text,boolean),
  public.seller_replace_weekly_availability(smallint[],time,time),
  public.seller_upsert_service_area(uuid,numeric,bigint,boolean),
  public.seller_upsert_service(uuid,bigint,bigint,text,integer,text[],text[],boolean),
  public.seller_update_public_profile(text,text,text,text[],uuid,text,text[],text[])
  from public, anon;
grant execute on function
  public.upsert_household_member(uuid,text,text,date,text,boolean),
  public.seller_replace_weekly_availability(smallint[],time,time),
  public.seller_upsert_service_area(uuid,numeric,bigint,boolean),
  public.seller_upsert_service(uuid,bigint,bigint,text,integer,text[],text[],boolean),
  public.seller_update_public_profile(text,text,text,text[],uuid,text,text[],text[])
  to authenticated;

notify pgrst, 'reload schema';
commit;
