create index badge_evaluation_badge_time
  on public.badge_evaluation_runs(badge_id, evaluated_at desc);

create index moderation_actions_actor_time
  on public.moderation_actions(actor_admin_id, created_at desc);
