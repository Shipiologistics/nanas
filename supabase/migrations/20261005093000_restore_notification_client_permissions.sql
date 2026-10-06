begin;

-- The extended-entity migration revoked table writes globally. The browser
-- needs these narrow operations; existing recipient/self RLS policies remain
-- the authority and prevent access to another user's notification records.
grant update (read_at, archived_at) on public.notifications to authenticated;
grant insert (user_id, event_category, in_app, email),
      update (user_id, event_category, in_app, email)
  on public.notification_preferences to authenticated;

-- Public catalog/profile policies call this predicate even for anonymous
-- readers. It only tests the current caller and returns false without a user;
-- it does not accept a target user ID or expose administrative data. Without
-- EXECUTE the entire public SELECT fails, including active public rows.
grant execute on function app_private.has_admin_permission(text) to anon;

commit;
