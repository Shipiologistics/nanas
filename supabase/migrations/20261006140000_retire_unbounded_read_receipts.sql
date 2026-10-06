begin;

-- The message-bounded receipt RPC supersedes this wall-clock endpoint. Leaving
-- it callable lets an old client clear messages that arrived after its fetch.
-- Keep the signature as an explicit failure for owner/service-side legacy code,
-- but revoke ordinary execution on both entry points. Never infer a message ID.
create or replace function app_private.mark_conversation_read(p_conversation_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$ begin
  raise exception 'read_message_id_required';
end; $$;
revoke all on function app_private.mark_conversation_read(uuid),public.mark_conversation_read(uuid)
from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
