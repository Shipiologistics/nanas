-- Keep historical request references intact while removing unapproved options
-- from every buyer and seller catalogue exposed through RLS.
update public.care_intake_subcategories
set active = false,
    updated_at = now()
where category_code = 'pet_care'
  and code in ('boarding', 'doggy_daycare');

update public.services
set active = false,
    updated_at = now()
where id in (
  '23000000-0000-0000-0000-000000000015',
  '23000000-0000-0000-0000-000000000016'
);

update public.care_intake_categories
set description = 'Pet sitting, walking, training and grooming.',
    updated_at = now()
where code = 'pet_care';
