begin;

create or replace function app_private.deliver_in_app_notification(p_outbox_id uuid)
returns void language plpgsql security definer set search_path=''
as $$ declare
  v_item public.notification_outbox%rowtype; v_role text; v_context text;
  v_conversation uuid; v_booking uuid; v_request uuid; v_link text; v_title text; v_body text;
begin
  select * into v_item from public.notification_outbox where id=p_outbox_id;
  if not found then return; end if;
  if exists(select 1 from public.notification_preferences where user_id=v_item.recipient_id
    and event_category=v_item.category and not in_app) then return; end if;
  v_conversation:=app_private.safe_uuid(v_item.variables_redacted->>'conversation_id');
  v_booking:=app_private.safe_uuid(v_item.variables_redacted->>'booking_id');
  v_request:=app_private.safe_uuid(v_item.variables_redacted->>'request_id');
  if v_conversation is not null then
    select role::text into v_context from public.conversation_members
      where conversation_id=v_conversation and user_id=v_item.recipient_id and left_at is null;
  elsif v_booking is not null then
    select case when buyer_id=v_item.recipient_id then 'buyer' when seller_id=v_item.recipient_id then 'seller' end
      into v_context from public.bookings where id=v_booking;
  end if;
  select role::text into v_role from public.user_roles where user_id=v_item.recipient_id and revoked_at is null
    order by case when role::text=v_context then 0
      when v_item.template_key like 'verification_%' and role::text='seller' then 1
      when v_item.template_key='quote_received' and role::text='buyer' then 1
      when role::text='buyer' then 2 when role::text='seller' then 3 else 4 end limit 1;
  v_link:=case when v_role in ('buyer','seller','admin') then '/app/'||v_role else '/auth' end;
  if v_link<>'/auth' then
    v_link:=v_link||case
      when v_item.template_key='purchase_receipt' then case when v_role='buyer' then '/wallet' when v_role='admin' then '/finance' else '/earnings' end
      when v_conversation is not null then '/messages'||case when v_role='admin' then '' else '/'||v_conversation::text end
      when v_booking is not null then '/bookings'
      when v_role='admin' then '/notifications'
      when v_item.template_key in ('verification_decision','verification_submitted') then case when v_role='seller' then '/kyc' else '/account' end
      when v_item.template_key='quote_received' then '/quotes'
      when v_request is not null then case when v_role='seller' then '/requests' else '/care-requests' end
      else '/notifications' end;
  end if;
  v_title:=case v_item.category when 'booking' then 'Nanas booking update' when 'messages' then 'New Nanas message'
    when 'payments' then 'Nanas payment update' when 'account' then 'Nanas account update' else 'Nanas update' end;
  -- Never copy a private message body, care note or document into a notification.
  v_body:=case v_item.template_key when 'new_message' then 'You have a new secure message.'
    when 'quote_received' then 'You received a new quote for your care request.'
    when 'booking_confirmed' then 'A Nanas care booking has been confirmed.'
    when 'booking_cancelled' then 'Your care booking was cancelled. Review booking details for the recorded fee and refund.'
    when 'booking_status_changed' then 'The status of your care booking changed.'
    when 'purchase_receipt' then 'A test purchase receipt is available in your payment records. No real money was charged.'
    when 'payment_captured' then 'A payment update is available in your booking.'
    when 'service_dispute_opened' then 'A service dispute was opened for your booking. Review the case in booking details.'
    when 'service_dispute_escalated' then 'Your booking dispute was escalated for further review.'
    when 'service_dispute_resolved' then 'Your booking dispute has a resolution. Review booking details and financial records.'
    when 'verification_decision' then 'Your provider verification has been updated.'
    else 'There is a new update in your Nanas account.' end;
  insert into public.notifications(id,recipient_id,event_type,category,title,body,deep_link,related_type,related_id)
    values(v_item.id,v_item.recipient_id,v_item.template_key,v_item.category,v_title,v_body,v_link,
      case when v_booking is not null then 'booking' when v_request is not null then 'booking_request' when v_conversation is not null then 'conversation' end,
      coalesce(v_booking,v_request,v_conversation)) on conflict(id) do nothing;
  insert into public.notification_deliveries(id,outbox_id,notification_id,channel,vendor,status,attempts,delivered_at)
    values(v_item.id,v_item.id,v_item.id,'in_app','nanas-database','delivered',1,now()) on conflict(id) do nothing;
end; $$;
revoke all on function app_private.deliver_in_app_notification(uuid) from public,anon,authenticated;


create function app_private.queue_purchase_receipt(p_payment_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare v_payment public.payment_intents%rowtype; v_request uuid; v_conversation uuid; v_owner uuid; v_amount bigint; v_currency text;
begin
  if exists(select 1 from public.notification_outbox where dedupe_key='purchase_receipt:'||p_payment_id::text) then return; end if;
  select * into v_payment from public.payment_intents where id=p_payment_id;
  if not found or v_payment.processor<>'simulation' or v_payment.status<>'captured'
    or v_payment.captured_minor<=0 or v_payment.refunded_minor<>0 then raise exception 'purchase_receipt_unavailable'; end if;
  select request_id,buyer_id,fee_minor_snapshot,currency into v_request,v_owner,v_amount,v_currency
    from public.booking_request_publications where payment_intent_id=p_payment_id;
  if v_request is null then
    select conversation_id,buyer_id,amount_minor,currency into v_conversation,v_owner,v_amount,v_currency
      from public.conversation_access_purchases where payment_intent_id=p_payment_id;
  end if;
  if v_owner is distinct from v_payment.payer_id or v_amount is distinct from v_payment.captured_minor
    or v_currency is distinct from v_payment.currency or (v_request is null and v_conversation is null)
    or (v_request is not null and v_payment.request_id is distinct from v_request)
    then raise exception 'purchase_receipt_mismatch'; end if;
  insert into public.notification_outbox(recipient_id,template_key,category,priority,variables_redacted,dedupe_key)
  values(v_owner,'purchase_receipt','payments','normal',
    jsonb_strip_nulls(jsonb_build_object('payment_id',p_payment_id,'request_id',v_request,'conversation_id',v_conversation)),
    'purchase_receipt:'||p_payment_id::text) on conflict(dedupe_key) do nothing;
end; $$;

create function app_private.purchase_receipt_trigger()
returns trigger language plpgsql security definer set search_path=''
as $$ begin
  if new.payment_intent_id is not null then perform app_private.queue_purchase_receipt(new.payment_intent_id); end if;
  return new;
end; $$;
create trigger request_publication_receipt after insert or update of payment_intent_id on public.booking_request_publications
for each row execute function app_private.purchase_receipt_trigger();
create trigger conversation_purchase_receipt after insert on public.conversation_access_purchases
for each row execute function app_private.purchase_receipt_trigger();
revoke all on function app_private.queue_purchase_receipt(uuid),app_private.purchase_receipt_trigger() from public,anon,authenticated;
commit;

