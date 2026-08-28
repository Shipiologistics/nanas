insert into public.islands (id,name,slug) values
('10000000-0000-0000-0000-000000000001','New Providence','new-providence'),
('10000000-0000-0000-0000-000000000002','Grand Bahama','grand-bahama'),
('10000000-0000-0000-0000-000000000003','Abaco','abaco')
on conflict (id) do update set name=excluded.name,active=true;

insert into public.service_areas (id,island_id,name,slug) values
('11000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Nassau & Paradise Island','nassau-paradise-island'),
('11000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Freeport & Lucaya','freeport-lucaya'),
('11000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003','Marsh Harbour','marsh-harbour')
on conflict (id) do update set name=excluded.name,active=true;

insert into public.service_categories (id,name,slug,description,icon_key,sort_order) values
('20000000-0000-0000-0000-000000000001','Senior & elder care','senior-care','Respectful support for older adults at home.','heart-handshake',10),
('20000000-0000-0000-0000-000000000002','Home nursing','home-nursing','Credentialed nursing support in the home.','stethoscope',20),
('20000000-0000-0000-0000-000000000003','Recovery support','recovery-support','Care after hospital discharge, surgery, or illness.','house-heart',30),
('20000000-0000-0000-0000-000000000004','Respite care','respite-care','Reliable relief for family caregivers.','clock-heart',40),
('20000000-0000-0000-0000-000000000005','Disability care','disability-care','Person-centred support for choice and independence.','accessibility',50),
('20000000-0000-0000-0000-000000000006','Rehabilitation','rehabilitation','At-home mobility and rehabilitation support.','activity',60)
on conflict (id) do update set name=excluded.name,description=excluded.description,active=true;

insert into public.services (id,category_id,name,slug,description,pricing_unit,minimum_duration_minutes,booking_increment_minutes,minimum_lead_minutes,maximum_advance_days,booking_modes,required_credential_types,risk_level) values
('21000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Senior care','senior-care','Companionship, mobility help, daily routine support, and approved personal care.','hour',120,30,120,90,array['scheduled','on_demand']::public.booking_mode[],array['identity','background_check'],'standard'),
('21000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Home nursing','home-nursing','Vital checks, wound care, medication support within scope, and recovery plans.','hour',60,30,240,90,array['scheduled']::public.booking_mode[],array['identity','rn_license','professional_indemnity'],'clinical'),
('21000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','Post-hospital care','post-hospital-care','Practical care and monitoring after discharge or surgery.','visit',90,30,240,60,array['scheduled']::public.booking_mode[],array['identity','healthcare_credential'],'elevated'),
('21000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000004','Respite care','respite-care','Short-term, planned care that gives family caregivers time to rest.','hour',180,60,360,90,array['scheduled']::public.booking_mode[],array['identity','background_check'],'standard'),
('21000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000005','Disability care','disability-care','Support for routines, participation, access, and independent living goals.','hour',120,30,240,90,array['scheduled']::public.booking_mode[],array['identity','background_check','care_training'],'elevated'),
('21000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000006','Physiotherapy','physiotherapy','At-home assessment, exercise, rehabilitation, and mobility support.','visit',60,30,360,60,array['scheduled']::public.booking_mode[],array['identity','physiotherapy_license','professional_indemnity'],'clinical')
on conflict (id) do update set name=excluded.name,description=excluded.description,required_credential_types=excluded.required_credential_types,active=true,version=public.services.version+1;

insert into public.badges (id,code,name,description,icon_key,issuer_type,criteria_public,rule_config) values
('30000000-0000-0000-0000-000000000001','identity_verified','Identity verified','Government-issued identity has been reviewed and is current.','badge-check','verification','Current approved identity verification.','{"verification_type":"identity"}'),
('30000000-0000-0000-0000-000000000002','credential_verified','Credential verified','A relevant healthcare credential has been reviewed and is current.','award','credential','Current approved healthcare credential.','{"credential_status":"approved"}'),
('30000000-0000-0000-0000-000000000003','background_checked','Background checked','A permitted background screening is current.','shield-check','verification','Current approved background check.','{"verification_type":"background_check"}'),
('30000000-0000-0000-0000-000000000004','highly_rated','Highly rated','Maintains strong ratings across verified completed bookings.','star','earned','At least 10 reviews and a 4.8+ rating.','{"minimum_reviews":10,"minimum_rating":4.8}'),
('30000000-0000-0000-0000-000000000005','reliable_responder','Reliable responder','Consistently responds to care requests within the expected window.','zap','earned','At least 90% response rate over the current window.','{"minimum_response_rate":90}'),
('30000000-0000-0000-0000-000000000006','experienced_seller','Experienced seller','Completed at least 25 care bookings through Nanas.','briefcase-medical','earned','At least 25 completed bookings.','{"minimum_completed_bookings":25}')
on conflict (id) do update set name=excluded.name,description=excluded.description,rule_config=excluded.rule_config,active=true;

insert into public.feature_flags (key,description,enabled,rollout_percent) values
('simulated_payments','Use protected local payment and payout simulation.',true,100),
('seller_quotes','Allow approved sellers to quote on healthcare care requests.',true,100),
('realtime_messages','Enable booking-scoped realtime messaging.',true,100),
('manual_kyc','Use Nanas admin review for seller KYC during beta.',true,100),
('cloudinary_uploads','Use Cloudinary instead of Supabase Storage for public media.',false,0)
on conflict (key) do update set description=excluded.description,enabled=excluded.enabled,rollout_percent=excluded.rollout_percent;

insert into public.system_settings (key,value) values
('market',jsonb_build_object('country_code','BS','calling_code','+1-242','currency','BSD','timezone','America/Nassau')),
('fees',jsonb_build_object('platform_fee_percent',8,'minimum_platform_fee_minor',0)),
('booking',jsonb_build_object('quote_expiry_hours',48,'review_window_days',7,'dispute_window_days',7,'session_code_minutes',30)),
('safety',jsonb_build_object('emergency_copy','Nanas is not an emergency service. Contact local emergency services for urgent help.'))
on conflict (key) do update set value=excluded.value,version=public.system_settings.version+1,updated_at=now();
