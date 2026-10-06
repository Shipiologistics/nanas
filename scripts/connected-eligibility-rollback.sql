-- Explicitly fictional QA identities in the authorized test project only.
-- Run the whole script. All fixture credentials, quotes, bookings, payments,
-- notifications and ledger entries are rolled back, never publicly committed.
begin;
create temporary table qa_eligibility_result(result jsonb) on commit drop;
do $qa$
declare
 v_seller uuid:='05e8eb22-5064-47a0-b226-0fd8dea3e97f';
 v_buyer uuid:='2458f843-d5c1-4b4d-bcde-bfe695459a9d';
 v_request uuid:='5f49bc23-2326-4622-8bf7-d68ce911c0cb';
 v_service uuid:='21000000-0000-0000-0000-000000000002';
 v_area uuid:='11000000-0000-0000-0000-000000000001';
 v_credential uuid; v_quote uuid; v_booking uuid; v_result jsonb; v_count bigint; v_payments bigint;
begin
 if exists(select 1 from public.seller_services where seller_id=v_seller and service_id=v_service)
   or exists(select 1 from public.seller_credentials where seller_id=v_seller)
 then raise exception 'QA baseline changed; stop and inspect'; end if;
 select count(*) into v_payments from public.payment_intents;
 insert into public.seller_services(seller_id,service_id,active,rate_minor,service_bio,capabilities)
 values(v_seller,v_service,true,5201,
   'LOCAL QA ONLY: this fictional service exists only inside a rollback transaction to verify credential eligibility. This provider is not a real nursing provider. Do not publish this fixture or arrange any care.',
   array['LOCAL QA eligibility test only']);
 perform set_config('request.jwt.claim.sub',v_seller::text,true);
 if app_private.provider_service_eligible(v_seller,v_service,v_area) then raise exception 'missing evidence authorized'; end if;
 v_result:=public.provider_request_feed(p_request_id=>v_request);
 if (v_result->>'total')::int<>0 then raise exception 'unqualified nursing visible'; end if;
 begin
   perform public.submit_seller_quote(v_request,5201,0,'LOCAL QA ONLY',now()+interval '2 days');
   raise exception 'unqualified quote unexpectedly succeeded';
 exception when others then
   if sqlerrm<>'provider_service_requirements_not_met' then raise; end if;
 end;
 insert into public.seller_credentials(seller_id,service_id,credential_type,status,issuing_body,expiry_date)
 values(v_seller,v_service,'rn_license','approved','FICTIONAL QA ONLY - ROLLBACK',(now() at time zone 'America/Nassau')::date+365)
 returning id into v_credential;
 insert into public.seller_credentials(seller_id,credential_type,status,issuing_body,expiry_date)
 values(v_seller,'professional_indemnity','approved','FICTIONAL QA ONLY - ROLLBACK',(now() at time zone 'America/Nassau')::date+365);
 if not app_private.provider_service_eligible(v_seller,v_service,v_area) then raise exception 'complete QA evidence did not authorize'; end if;
 v_result:=public.provider_request_feed(p_request_id=>v_request);
 if (v_result->>'total')::int<>1 then raise exception 'qualified exact request missing'; end if;
 v_result:=public.submit_seller_quote(v_request,5201,0,'LOCAL QA ONLY - ROLLBACK. No real care.',now()+interval '2 days');
 v_quote:=(v_result->>'quote_id')::uuid;
 if v_quote is null then raise exception 'no quote returned'; end if;
 update public.seller_credentials set expiry_date=(now() at time zone 'America/Nassau')::date-1 where id=v_credential;
 perform set_config('request.jwt.claim.sub',v_buyer::text,true);
 begin
   perform public.accept_quote_with_simulated_payment(v_quote,'qa-eligibility-rollback-20261006');
   raise exception 'expired licence checkout unexpectedly succeeded';
 exception when others then
   if sqlerrm<>'provider_service_requirements_not_met' then raise; end if;
 end;
 if (select count(*) from public.payment_intents)<>v_payments
   or exists(select 1 from public.bookings where quote_id=v_quote)
 then raise exception 'failed checkout leaked booking/payment'; end if;
 update public.seller_credentials set expiry_date=(now() at time zone 'America/Nassau')::date+365 where id=v_credential;
 v_result:=public.accept_quote_with_simulated_payment(v_quote,'qa-eligibility-rollback-20261006');
 v_booking:=(v_result->>'booking_id')::uuid;
 if v_booking is null then raise exception 'eligible checkout failed'; end if;
 if not exists(select 1 from public.payment_intents where booking_id=v_booking and processor='simulation'
   and captured_minor=11235 and currency='BSD') then raise exception 'wrong simulation receipt'; end if;
 if (select coalesce(sum(case when direction='debit' then amount_minor else -amount_minor end),0)
   from public.ledger_entries where booking_id=v_booking)<>0 then raise exception 'unbalanced fixture ledger'; end if;
 update public.seller_credentials set status='expired' where id=v_credential;
 v_result:=public.accept_quote_with_simulated_payment(v_quote,'qa-eligibility-rollback-20261006');
 if not (v_result->>'replayed')::boolean or (v_result->>'booking_id')::uuid<>v_booking
 then raise exception 'historical retry broken by later expiry'; end if;
 select count(*) into v_count from public.payment_intents where booking_id=v_booking;
 if v_count<>1 then raise exception 'duplicate fixture capture'; end if;
 insert into qa_eligibility_result values(jsonb_build_object(
   'unqualified_discovery','denied','unqualified_quote','denied','complete_evidence','matched',
   'expired_quote_checkout','denied_without_payment','valid_checkout','simulation_only',
   'captured_minor',11235,'ledger_imbalance_minor',0,'historical_retry','same_booking_one_payment',
   'persistence','all fixture writes rolled back by final statement'));
end $qa$;
select result from qa_eligibility_result;
rollback;
