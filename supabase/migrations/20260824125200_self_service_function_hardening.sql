alter function public.upsert_household_member(uuid,text,text,date,text,boolean) set schema app_private;
alter function public.seller_upsert_service(uuid,bigint,text,boolean) set schema app_private;
alter function public.seller_replace_weekly_availability(smallint[],time,time) set schema app_private;
alter function public.seller_update_public_profile(text,text,integer,text[],uuid,text) set schema app_private;
alter function public.seller_upsert_service_area(uuid,numeric,bigint,boolean) set schema app_private;

create function public.upsert_household_member(uuid,text,text,date,text,boolean)
returns jsonb language sql security invoker set search_path=''
as $function$ select app_private.upsert_household_member($1,$2,$3,$4,$5,$6); $function$;
create function public.seller_upsert_service(uuid,bigint,text,boolean)
returns jsonb language sql security invoker set search_path=''
as $function$ select app_private.seller_upsert_service($1,$2,$3,$4); $function$;
create function public.seller_replace_weekly_availability(smallint[],time,time)
returns jsonb language sql security invoker set search_path=''
as $function$ select app_private.seller_replace_weekly_availability($1,$2,$3); $function$;
create function public.seller_update_public_profile(text,text,integer,text[],uuid,text)
returns jsonb language sql security invoker set search_path=''
as $function$ select app_private.seller_update_public_profile($1,$2,$3,$4,$5,$6); $function$;
create function public.seller_upsert_service_area(uuid,numeric,bigint,boolean)
returns jsonb language sql security invoker set search_path=''
as $function$ select app_private.seller_upsert_service_area($1,$2,$3,$4); $function$;

revoke all on function app_private.upsert_household_member(uuid,text,text,date,text,boolean), app_private.seller_upsert_service(uuid,bigint,text,boolean), app_private.seller_replace_weekly_availability(smallint[],time,time), app_private.seller_update_public_profile(text,text,integer,text[],uuid,text), app_private.seller_upsert_service_area(uuid,numeric,bigint,boolean) from public,anon;
revoke all on function public.upsert_household_member(uuid,text,text,date,text,boolean), public.seller_upsert_service(uuid,bigint,text,boolean), public.seller_replace_weekly_availability(smallint[],time,time), public.seller_update_public_profile(text,text,integer,text[],uuid,text), public.seller_upsert_service_area(uuid,numeric,bigint,boolean) from public,anon;
grant execute on function app_private.upsert_household_member(uuid,text,text,date,text,boolean), app_private.seller_upsert_service(uuid,bigint,text,boolean), app_private.seller_replace_weekly_availability(smallint[],time,time), app_private.seller_update_public_profile(text,text,integer,text[],uuid,text), app_private.seller_upsert_service_area(uuid,numeric,bigint,boolean) to authenticated;
grant execute on function public.upsert_household_member(uuid,text,text,date,text,boolean), public.seller_upsert_service(uuid,bigint,text,boolean), public.seller_replace_weekly_availability(smallint[],time,time), public.seller_update_public_profile(text,text,integer,text[],uuid,text), public.seller_upsert_service_area(uuid,numeric,bigint,boolean) to authenticated;
