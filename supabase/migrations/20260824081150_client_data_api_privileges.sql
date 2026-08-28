begin;

-- The preceding extended-entity migration deliberately reset public-table
-- grants. Restore only the columns and operations intentionally used by the
-- authenticated browser client; RLS remains the row-level authority.
grant insert (conversation_id, sender_id, message_type, body, reply_to_id, sender_nonce)
  on public.messages to authenticated;

drop policy if exists conversation_members_self_read_receipt on public.conversation_members;
create policy conversation_members_self_read_receipt
  on public.conversation_members
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant update (last_read_at) on public.conversation_members to authenticated;

grant insert (buyer_id, seller_id), update (buyer_id, seller_id), delete
  on public.favorites to authenticated;
grant insert (user_id, request_type, due_at)
  on public.privacy_requests to authenticated;
grant insert (booking_id, reporter_id, category, severity)
  on public.safety_incidents to authenticated;

commit;
