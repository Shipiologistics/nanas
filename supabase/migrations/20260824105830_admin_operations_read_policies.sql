create policy worker_runs_admin_read
  on public.worker_runs
  for select
  to authenticated
  using (app_private.has_admin_permission('workers.read'));

create policy dead_letters_admin_read
  on public.dead_letters
  for select
  to authenticated
  using (app_private.has_admin_permission('workers.read'));

grant select on public.worker_runs to authenticated;
grant select on public.dead_letters to authenticated;
