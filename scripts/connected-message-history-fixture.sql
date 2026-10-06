-- Authorized QA-only history, never real-person messages. Re-runnable.
begin;
do $$ begin
  if (select count(*) from public.conversation_members where conversation_id='3594308b-1d57-4629-b79f-e4141733850f')<>2
    or exists(select 1 from public.conversation_members where conversation_id='3594308b-1d57-4629-b79f-e4141733850f'
      and user_id not in ('2458f843-d5c1-4b4d-bcde-bfe695459a9d','05e8eb22-5064-47a0-b226-0fd8dea3e97f'))
    then raise exception 'QA participants do not match'; end if;
end $$;
create temporary table qa_history_member_state on commit drop as
 select user_id,muted from public.conversation_members where conversation_id='3594308b-1d57-4629-b79f-e4141733850f';
update public.conversation_members set muted=true where conversation_id='3594308b-1d57-4629-b79f-e4141733850f';
insert into public.messages(id,conversation_id,sender_id,message_type,body,sender_nonce,created_at)
 select ('6a060900-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '3594308b-1d57-4629-b79f-e4141733850f','05e8eb22-5064-47a0-b226-0fd8dea3e97f','text',
 'LOCAL QA HISTORY '||lpad(n::text,4,'0')||' - fictional pagination fixture; not a care instruction.',
 'local-qa-history-20261006-'||n,'2026-10-01T12:00:00.000001Z'::timestamptz
 from generate_series(1,505) n on conflict(sender_id,sender_nonce) do nothing;
update public.conversation_members m set muted=s.muted from qa_history_member_state s
 where m.conversation_id='3594308b-1d57-4629-b79f-e4141733850f' and m.user_id=s.user_id;
commit;
select count(*) as fixture_rows,
 (select count(*) from public.notification_outbox where variables_redacted->>'message_id' like '6a060900-0000-4000-8000-%') as fixture_notifications,
 (select count(*) from public.conversation_members where conversation_id='3594308b-1d57-4629-b79f-e4141733850f' and muted) as muted_members
 from public.messages where sender_nonce like 'local-qa-history-20261006-%';
