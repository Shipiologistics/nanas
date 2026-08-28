begin;

alter table public.admin_permissions
  drop constraint if exists admin_permissions_permission_key_check;
alter table public.admin_permissions
  add constraint admin_permissions_permission_key_check
  check (permission_key = '*' or permission_key ~ '^[a-z][a-z0-9_.-]{2,80}$');

commit;
