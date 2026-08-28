create table public.care_intake_categories (
  code text primary key check (code ~ '^[a-z0-9_]+$'),
  name text not null unique check (char_length(name) between 2 and 80),
  description text not null check (char_length(description) between 5 and 300),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.care_intake_subcategories (
  category_code text not null references public.care_intake_categories(code) on update cascade on delete restrict,
  code text not null check (code ~ '^[a-z0-9_]+$'),
  name text not null check (char_length(name) between 2 and 80),
  service_id uuid not null unique references public.services(id) on delete restrict,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (category_code,code)
);

insert into public.service_categories(id,name,slug,description,icon_key,sort_order,active)
values
  ('22000000-0000-0000-0000-000000000001','Child care','child-care','Age-appropriate care for children in Bahamian families.','users',110,true),
  ('22000000-0000-0000-0000-000000000002','Senior care marketplace','senior-care-marketplace','Companion, hands-on and live-in support for older adults.','heart-handshake',120,true),
  ('22000000-0000-0000-0000-000000000003','Adult care marketplace','adult-care-marketplace','Everyday support for adults and independent living.','shield-check',130,true),
  ('22000000-0000-0000-0000-000000000004','Pet care','pet-care','Individual pet sitting, walking, training and grooming services.','heart-pulse',140,true),
  ('22000000-0000-0000-0000-000000000005','Housekeeping','housekeeping','Individual home cleaning, personal assistance and errands.','house',150,true),
  ('22000000-0000-0000-0000-000000000006','Tutoring','tutoring','Individual academic tutoring and test preparation.','book-open',160,true)
on conflict (id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,icon_key=excluded.icon_key,sort_order=excluded.sort_order,active=excluded.active,updated_at=now();

insert into public.services(id,category_id,name,slug,description,pricing_unit,risk_level,active)
values
  ('23000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000001','Babysitter','child-care-babysitter','Short-term child care in the family home.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000002','22000000-0000-0000-0000-000000000001','Nanny','child-care-nanny','Recurring child care and family routine support.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000003','22000000-0000-0000-0000-000000000001','Daycare centers','child-care-daycare-centers','Daytime child care matching for approved individual sellers.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000004','22000000-0000-0000-0000-000000000001','Special needs child care','child-care-special-needs','Child care from sellers with relevant special-needs experience.','hour','elevated',true),
  ('23000000-0000-0000-0000-000000000005','22000000-0000-0000-0000-000000000002','Senior companion','senior-care-companion','Companionship and practical everyday senior support.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000006','22000000-0000-0000-0000-000000000002','Senior hands-on care','senior-care-hands-on','Hands-on personal and mobility support for older adults.','hour','elevated',true),
  ('23000000-0000-0000-0000-000000000007','22000000-0000-0000-0000-000000000002','Senior live-in care','senior-care-live-in','Live-in support for older adults.','hour','elevated',true),
  ('23000000-0000-0000-0000-000000000008','22000000-0000-0000-0000-000000000003','Adult companion','adult-care-companion','Companionship and practical everyday adult support.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000009','22000000-0000-0000-0000-000000000003','Adult hands-on care','adult-care-hands-on','Hands-on personal and mobility support for adults.','hour','elevated',true),
  ('23000000-0000-0000-0000-000000000010','22000000-0000-0000-0000-000000000003','Adult live-in care','adult-care-live-in','Live-in independent-living support for adults.','hour','elevated',true),
  ('23000000-0000-0000-0000-000000000011','22000000-0000-0000-0000-000000000004','Pet sitter','pet-care-sitter','In-home pet sitting by an individual seller.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000012','22000000-0000-0000-0000-000000000004','Dog walker','pet-care-walker','Scheduled dog walking.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000013','22000000-0000-0000-0000-000000000004','Pet trainer','pet-care-trainer','Individual pet training support.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000014','22000000-0000-0000-0000-000000000004','Pet groomer','pet-care-groomer','Individual pet grooming support.','visit','standard',true),
  ('23000000-0000-0000-0000-000000000015','22000000-0000-0000-0000-000000000004','Pet boarding','pet-care-boarding','Pet boarding with an approved individual seller.','day','standard',true),
  ('23000000-0000-0000-0000-000000000016','22000000-0000-0000-0000-000000000004','Doggy daycare','pet-care-doggy-daycare','Daytime dog care with an approved individual seller.','day','standard',true),
  ('23000000-0000-0000-0000-000000000017','22000000-0000-0000-0000-000000000005','Housekeeper','housekeeping-housekeeper','Recurring housekeeping from an individual seller.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000018','22000000-0000-0000-0000-000000000005','House cleaning','housekeeping-house-cleaning','One-time or recurring home cleaning.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000019','22000000-0000-0000-0000-000000000005','Personal assistant','housekeeping-personal-assistant','Individual help with household organization and routines.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000020','22000000-0000-0000-0000-000000000005','Errands and odd jobs','housekeeping-errands-odd-jobs','Individual help with errands and practical household tasks.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000021','22000000-0000-0000-0000-000000000006','Math tutor','tutoring-math','Individual mathematics tutoring.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000022','22000000-0000-0000-0000-000000000006','Science tutor','tutoring-science','Individual science tutoring.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000023','22000000-0000-0000-0000-000000000006','Test prep tutor','tutoring-test-prep','Individual test preparation tutoring.','hour','standard',true),
  ('23000000-0000-0000-0000-000000000024','22000000-0000-0000-0000-000000000006','Other subject tutor','tutoring-more-subjects','Individual tutoring across additional subjects.','hour','standard',true)
on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,pricing_unit=excluded.pricing_unit,risk_level=excluded.risk_level,active=excluded.active,updated_at=now();

insert into public.care_intake_categories(code,name,description,sort_order)
values
 ('child_care','Child care','Babysitters, nannies, daycare matching and special-needs support.',10),
 ('senior_care','Senior care','Companion, hands-on and live-in senior support.',20),
 ('adult_care','Adult care','Companion, hands-on and live-in adult support.',30),
 ('pet_care','Pet care','Pet sitting, walking, training, grooming, boarding and daycare.',40),
 ('housekeeping','Housekeeping','Housekeeping, cleaning, personal assistance and errands.',50),
 ('tutoring','Tutoring','Academic tutoring, science, math and test preparation.',60)
on conflict (code) do update set name=excluded.name,description=excluded.description,sort_order=excluded.sort_order,active=true,updated_at=now();

insert into public.care_intake_subcategories(category_code,code,name,service_id,sort_order)
values
 ('child_care','babysitter','Babysitter','23000000-0000-0000-0000-000000000001',10),('child_care','nanny','Nanny','23000000-0000-0000-0000-000000000002',20),('child_care','daycare_centers','Daycare centers','23000000-0000-0000-0000-000000000003',30),('child_care','special_needs','Special needs','23000000-0000-0000-0000-000000000004',40),
 ('senior_care','companion','Companion','23000000-0000-0000-0000-000000000005',10),('senior_care','hands_on','Hands-on','23000000-0000-0000-0000-000000000006',20),('senior_care','live_in','Live-in','23000000-0000-0000-0000-000000000007',30),
 ('adult_care','companion','Companion','23000000-0000-0000-0000-000000000008',10),('adult_care','hands_on','Hands-on','23000000-0000-0000-0000-000000000009',20),('adult_care','live_in','Live-in','23000000-0000-0000-0000-000000000010',30),
 ('pet_care','pet_sitter','Sitter','23000000-0000-0000-0000-000000000011',10),('pet_care','dog_walker','Walker','23000000-0000-0000-0000-000000000012',20),('pet_care','pet_trainer','Trainer','23000000-0000-0000-0000-000000000013',30),('pet_care','pet_groomer','Groomer','23000000-0000-0000-0000-000000000014',40),('pet_care','boarding','Boarding','23000000-0000-0000-0000-000000000015',50),('pet_care','doggy_daycare','Doggy daycare','23000000-0000-0000-0000-000000000016',60),
 ('housekeeping','housekeeper','Housekeeper','23000000-0000-0000-0000-000000000017',10),('housekeeping','house_cleaning','House cleaning','23000000-0000-0000-0000-000000000018',20),('housekeeping','personal_assistant','Personal assistant','23000000-0000-0000-0000-000000000019',30),('housekeeping','errands_odd_jobs','Errands & odd jobs','23000000-0000-0000-0000-000000000020',40),
 ('tutoring','math','Math','23000000-0000-0000-0000-000000000021',10),('tutoring','science','Science','23000000-0000-0000-0000-000000000022',20),('tutoring','test_prep','Test prep','23000000-0000-0000-0000-000000000023',30),('tutoring','more_subjects','More subjects','23000000-0000-0000-0000-000000000024',40)
on conflict (category_code,code) do update set name=excluded.name,service_id=excluded.service_id,sort_order=excluded.sort_order,active=true,updated_at=now();

create table public.booking_request_intake_answers (
  request_id uuid primary key references public.booking_requests(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  category_code text not null,
  subcategory_code text not null,
  private_answers jsonb not null default '{}'::jsonb check (jsonb_typeof(private_answers)='object'),
  public_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(public_summary)='object'),
  created_at timestamptz not null default now(),
  foreign key (category_code,subcategory_code) references public.care_intake_subcategories(category_code,code)
);

create index booking_request_intake_answers_buyer on public.booking_request_intake_answers(buyer_id,created_at desc);
create index care_intake_subcategories_active on public.care_intake_subcategories(category_code,sort_order) where active;

alter table public.care_intake_categories enable row level security;
alter table public.care_intake_subcategories enable row level security;
alter table public.booking_request_intake_answers enable row level security;

create policy care_intake_categories_public_read on public.care_intake_categories for select to anon,authenticated using (active or app_private.has_admin_permission('config.manage'));
create policy care_intake_subcategories_public_read on public.care_intake_subcategories for select to anon,authenticated using (active or app_private.has_admin_permission('config.manage'));
create policy request_intake_buyer_admin_read on public.booking_request_intake_answers for select to authenticated using (buyer_id=(select auth.uid()) or app_private.has_admin_permission('bookings.read'));

revoke all on public.care_intake_categories,public.care_intake_subcategories,public.booking_request_intake_answers from anon,authenticated;
grant select on public.care_intake_categories,public.care_intake_subcategories to anon,authenticated;
grant select on public.booking_request_intake_answers to authenticated;

create or replace function app_private.attach_care_request_intake(p_payload jsonb,p_result jsonb)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user uuid := (select auth.uid()); v_request uuid; v_category text; v_subcategory text; v_service uuid;
begin
  if v_user is null or not app_private.has_role('buyer') then raise exception 'buyer_required'; end if;
  v_request := (p_result->>'request_id')::uuid;
  v_category := nullif(p_payload->>'category_code','');
  v_subcategory := nullif(p_payload->>'subcategory_code','');
  if v_category is null or v_subcategory is null then raise exception 'care_category_required'; end if;
  select service_id into v_service from public.care_intake_subcategories where category_code=v_category and code=v_subcategory and active;
  if v_service is null or v_service<>(p_payload->>'service_id')::uuid then raise exception 'invalid_care_category_service'; end if;
  if not exists(select 1 from public.booking_requests where id=v_request and buyer_id=v_user) then raise exception 'request_ownership_required'; end if;
  insert into public.booking_request_intake_answers(request_id,buyer_id,category_code,subcategory_code,private_answers,public_summary)
  values(v_request,v_user,v_category,v_subcategory,coalesce(p_payload->'intake_answers','{}'::jsonb),coalesce(p_payload->'intake_public_summary','{}'::jsonb));
end; $$;

create or replace function public.create_care_request(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_result jsonb;
begin
  v_result := app_private.create_care_request(p_payload);
  perform app_private.attach_care_request_intake(p_payload,v_result);
  return v_result;
end; $$;

revoke execute on function app_private.attach_care_request_intake(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_care_request(jsonb) to authenticated;
