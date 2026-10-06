begin;
create or replace function public.mark_conversation_read_through(p_conversation_id uuid,p_message_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_time timestamptz;
begin
  if not app_private.is_conversation_member(p_conversation_id) then raise exception 'conversation_unavailable'; end if;
  if app_private.conversation_is_locked(p_conversation_id) then raise exception 'conversation_locked'; end if;
  select created_at into v_time from public.messages where id=p_message_id and conversation_id=p_conversation_id and deleted_at is null;
  if not found then raise exception 'message_unavailable'; end if;
  update public.conversation_members set last_read_at=greatest(coalesce(last_read_at,'-infinity'::timestamptz),least(v_time,now()))
    where conversation_id=p_conversation_id and user_id=(select auth.uid()) and left_at is null;
  return jsonb_build_object('ok',true,'read_through',v_time);
end;
$$;
revoke all on function public.mark_conversation_read_through(uuid,uuid) from public,anon;
grant execute on function public.mark_conversation_read_through(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
