begin;

-- Public profile photos can be backed by either the legacy owner-scoped
-- Supabase bucket or a signed Cloudinary upload in the seller's own folder.
create or replace function app_private.seller_update_public_profile(
  p_display_name text,
  p_avatar_path text,
  p_headline text,
  p_languages text[],
  p_island_id uuid,
  p_locality text,
  p_vaccinations text[],
  p_additional_details text[]
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_display_name text := trim(coalesce(p_display_name, ''));
  v_avatar_path text := nullif(trim(coalesce(p_avatar_path, '')), '');
  v_languages text[];
  v_vaccinations text[];
  v_additional_details text[];
begin
  if v_user is null or not app_private.has_role('seller') then
    raise exception 'seller_required';
  end if;
  if char_length(v_display_name) not between 2 and 80 then
    raise exception 'invalid_display_name';
  end if;
  if char_length(trim(coalesce(p_headline, ''))) > 120 then
    raise exception 'profile_text_too_long';
  end if;

  select coalesce(array_agg(value order by ordinal), array['English']::text[])
  into v_languages
  from (
    select distinct on (lower(trim(item))) trim(item) as value, ordinal
    from unnest(coalesce(p_languages, array['English']::text[])) with ordinality as source(item, ordinal)
    where char_length(trim(item)) between 2 and 40
    order by lower(trim(item)), ordinal
  ) normalized;

  select coalesce(array_agg(value order by ordinal), '{}'::text[])
  into v_vaccinations
  from (
    select distinct on (lower(trim(item))) trim(item) as value, ordinal
    from unnest(coalesce(p_vaccinations, '{}'::text[])) with ordinality as source(item, ordinal)
    where char_length(trim(item)) between 2 and 80
    order by lower(trim(item)), ordinal
  ) normalized;

  select coalesce(array_agg(value order by ordinal), '{}'::text[])
  into v_additional_details
  from (
    select distinct on (lower(trim(item))) trim(item) as value, ordinal
    from unnest(coalesce(p_additional_details, '{}'::text[])) with ordinality as source(item, ordinal)
    where char_length(trim(item)) between 2 and 100
    order by lower(trim(item)), ordinal
  ) normalized;

  if cardinality(v_languages) not between 1 and 12
     or cardinality(v_vaccinations) > 20
     or cardinality(v_additional_details) > 20 then
    raise exception 'invalid_profile_details';
  end if;
  if p_island_id is not null and not exists (
    select 1 from public.islands where id = p_island_id and active
  ) then
    raise exception 'invalid_island';
  end if;
  if char_length(trim(coalesce(p_locality, ''))) > 100 then
    raise exception 'invalid_locality';
  end if;
  if v_avatar_path is not null and not (
    v_avatar_path ~ (
      '^cloudinary:image:upload:(jpg|jpeg|png|webp|gif):nanas/public/users/'
      || v_user::text
      || '/profile/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
    or exists (
      select 1
      from storage.objects
      where bucket_id = 'public-profile-media'
        and name = v_avatar_path
        and owner_id = v_user::text
    )
  ) then
    raise exception 'invalid_profile_photo';
  end if;

  update public.seller_profiles
  set display_name = v_display_name,
      avatar_path = v_avatar_path,
      headline = nullif(trim(coalesce(p_headline, '')), ''),
      languages = v_languages,
      island_id = p_island_id,
      locality = nullif(trim(coalesce(p_locality, '')), ''),
      vaccinations = v_vaccinations,
      additional_details = v_additional_details,
      updated_at = now()
  where user_id = v_user;

  if not found then raise exception 'seller_profile_not_found'; end if;

  update public.profiles
  set display_name = v_display_name,
      avatar_path = v_avatar_path,
      updated_at = now()
  where id = v_user;

  return jsonb_build_object('ok', true, 'avatar_path', v_avatar_path);
end
$function$;

commit;
