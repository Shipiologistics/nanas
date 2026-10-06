begin;

-- Retain the storage key and all existing subcategories/answers. The public
-- Home healthcare family includes the original clinical catalogue services.
update public.care_intake_categories
set name='Home healthcare',
    description='Home nursing, recovery, therapy and everyday adult support.',
    updated_at=now()
where code='adult_care';

insert into public.care_intake_subcategories(category_code,code,name,service_id,sort_order)
values
 ('senior_care','senior_care','Senior care','21000000-0000-0000-0000-000000000001',1),
 ('senior_care','respite_care','Respite care','21000000-0000-0000-0000-000000000004',2),
 ('adult_care','home_nursing','Home nursing','21000000-0000-0000-0000-000000000002',1),
 ('adult_care','post_hospital_care','Post-hospital care','21000000-0000-0000-0000-000000000003',2),
 ('adult_care','disability_care','Disability care','21000000-0000-0000-0000-000000000005',3),
 ('adult_care','physiotherapy','Physiotherapy','21000000-0000-0000-0000-000000000006',4)
on conflict (category_code,code) do update
set name=excluded.name, service_id=excluded.service_id,
    sort_order=excluded.sort_order, updated_at=now();

-- Do not change provider services, qualifications, risk levels or permissions.
-- Existing exact-service validation and provider matching continue to apply.
commit;
