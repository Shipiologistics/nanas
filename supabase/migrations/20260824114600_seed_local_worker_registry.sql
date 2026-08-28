insert into public.scheduled_workers(key, schedule, enabled, health_status, next_run_at)
values
  ('maintenance', '0 * * * *', true, 'ready', now() + interval '1 hour'),
  ('notification_dispatch', '*/1 * * * *', true, 'ready', now() + interval '1 minute'),
  ('expire_offers', '*/1 * * * *', true, 'ready', now() + interval '1 minute'),
  ('auto_complete', '*/5 * * * *', true, 'ready', now() + interval '5 minutes'),
  ('publish_reviews', '15 * * * *', true, 'ready', now() + interval '1 hour'),
  ('expire_credentials', '20 2 * * *', true, 'ready', now() + interval '1 day'),
  ('evaluate_badges', '40 2 * * *', true, 'ready', now() + interval '1 day'),
  ('reminders', '*/5 * * * *', true, 'ready', now() + interval '5 minutes'),
  ('purge', '10 3 * * *', true, 'ready', now() + interval '1 day'),
  ('analytics', '30 3 * * *', true, 'ready', now() + interval '1 day')
on conflict (key) do update
set schedule = excluded.schedule,
    enabled = excluded.enabled,
    health_status = excluded.health_status,
    next_run_at = excluded.next_run_at,
    updated_at = now();
