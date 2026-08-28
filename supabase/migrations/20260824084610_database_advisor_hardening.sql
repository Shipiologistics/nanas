-- Address Supabase database-advisor findings without changing application behaviour.

-- Aggregate tables use surrogate keys because their natural uniqueness includes
-- nullable dimensions and is already enforced by UNIQUE NULLS NOT DISTINCT.
alter table public.rating_aggregates
  add column id uuid not null default gen_random_uuid(),
  add constraint rating_aggregates_pkey primary key (id);

alter table public.analytics_daily
  add column id uuid not null default gen_random_uuid(),
  add constraint analytics_daily_pkey primary key (id);

-- Every foreign key should have a matching leading-column index. This loop is
-- deterministic and skips primary keys, unique indexes, and existing FK indexes.
do $migration$
declare
  fk record;
  column_list text;
  index_name text;
begin
  for fk in
    select c.conrelid, c.conname, c.conkey, cls.relname
    from pg_constraint c
    join pg_class cls on cls.oid = c.conrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    where c.contype = 'f'
      and ns.nspname = 'public'
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = c.conrelid
          and i.indisvalid
          and i.indpred is null
          and (i.indkey::smallint[])[0:cardinality(c.conkey) - 1] = c.conkey
      )
  loop
    select string_agg(quote_ident(a.attname), ', ' order by key_column.ordinality)
      into column_list
    from unnest(fk.conkey) with ordinality as key_column(attnum, ordinality)
    join pg_attribute a
      on a.attrelid = fk.conrelid
     and a.attnum = key_column.attnum;

    index_name := 'idx_fk_' || left(fk.relname, 28) || '_' || left(md5(fk.conname), 10);
    execute format('create index if not exists %I on public.%I (%s)', index_name, fk.relname, column_list);
  end loop;
end
$migration$;

-- Split broad ALL policies into mutation-only policies so SELECT has one
-- permissive policy per role/action. This preserves every prior condition.
drop policy if exists availability_owner_manage on public.availability_rules;
create policy availability_owner_insert on public.availability_rules for insert to authenticated
  with check (seller_id = (select auth.uid()));
create policy availability_owner_update on public.availability_rules for update to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
create policy availability_owner_delete on public.availability_rules for delete to authenticated
  using (seller_id = (select auth.uid()));

drop policy if exists seller_areas_owner_manage on public.seller_service_areas;
create policy seller_areas_owner_insert on public.seller_service_areas for insert to authenticated
  with check (seller_id = (select auth.uid()));
create policy seller_areas_owner_update on public.seller_service_areas for update to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
create policy seller_areas_owner_delete on public.seller_service_areas for delete to authenticated
  using (seller_id = (select auth.uid()));

drop policy if exists seller_services_owner on public.seller_services;
create policy seller_services_owner_insert on public.seller_services for insert to authenticated
  with check (seller_id = (select auth.uid()) or app_private.has_admin_permission('sellers.manage'));
create policy seller_services_owner_update on public.seller_services for update to authenticated
  using (seller_id = (select auth.uid()) or app_private.has_admin_permission('sellers.manage'))
  with check (seller_id = (select auth.uid()) or app_private.has_admin_permission('sellers.manage'));
create policy seller_services_owner_delete on public.seller_services for delete to authenticated
  using (seller_id = (select auth.uid()) or app_private.has_admin_permission('sellers.manage'));

drop policy if exists feature_flags_admin_manage on public.feature_flags;
create policy feature_flags_admin_insert on public.feature_flags for insert to authenticated
  with check (app_private.has_admin_permission('config.manage'));
create policy feature_flags_admin_update on public.feature_flags for update to authenticated
  using (app_private.has_admin_permission('config.manage')) with check (app_private.has_admin_permission('config.manage'));
create policy feature_flags_admin_delete on public.feature_flags for delete to authenticated
  using (app_private.has_admin_permission('config.manage'));

drop policy if exists catalog_admin_categories on public.service_categories;
create policy catalog_admin_categories_insert on public.service_categories for insert to authenticated
  with check (app_private.has_admin_permission('catalog.manage'));
create policy catalog_admin_categories_update on public.service_categories for update to authenticated
  using (app_private.has_admin_permission('catalog.manage')) with check (app_private.has_admin_permission('catalog.manage'));
create policy catalog_admin_categories_delete on public.service_categories for delete to authenticated
  using (app_private.has_admin_permission('catalog.manage'));

drop policy if exists catalog_admin_services on public.services;
create policy catalog_admin_services_insert on public.services for insert to authenticated
  with check (app_private.has_admin_permission('catalog.manage'));
create policy catalog_admin_services_update on public.services for update to authenticated
  using (app_private.has_admin_permission('catalog.manage')) with check (app_private.has_admin_permission('catalog.manage'));
create policy catalog_admin_services_delete on public.services for delete to authenticated
  using (app_private.has_admin_permission('catalog.manage'));

drop policy if exists settings_admin_manage on public.system_settings;
create policy settings_admin_insert on public.system_settings for insert to authenticated
  with check (app_private.has_admin_permission('config.manage'));
create policy settings_admin_update on public.system_settings for update to authenticated
  using (app_private.has_admin_permission('config.manage')) with check (app_private.has_admin_permission('config.manage'));
create policy settings_admin_delete on public.system_settings for delete to authenticated
  using (app_private.has_admin_permission('config.manage'));
