begin;

-- The bootstrap constraints used a doubled backslash in a standard SQL
-- string. PostgreSQL passed that through to the regex engine as a literal
-- backslash pattern, so valid E.164 values beginning with `+` were rejected.
-- A character class expresses the literal plus without escape ambiguity.
alter table public.profiles drop constraint if exists profiles_phone_e164_check;
alter table public.profiles add constraint profiles_phone_e164_check
  check (phone_e164 is null or phone_e164 ~ '^[+][1-9][0-9]{7,14}$');

alter table public.emergency_contacts drop constraint if exists emergency_contacts_phone_e164_check;
alter table public.emergency_contacts add constraint emergency_contacts_phone_e164_check
  check (phone_e164 ~ '^[+][1-9][0-9]{7,14}$');

commit;
