-- The Care.com-style seller profile has one authoritative public profile row.
-- Preserve any legacy language rows before removing the unused duplicate table.
update public.seller_profiles sp
set languages = legacy.languages,
    updated_at = now()
from (
  select seller_id,
         array_agg(language_tag order by
           case proficiency
             when 'native' then 1
             when 'fluent' then 2
             when 'conversational' then 3
             else 4
           end,
           language_tag
         ) as languages
  from public.seller_languages
  group by seller_id
) legacy
where sp.user_id = legacy.seller_id;

drop table if exists public.seller_languages;
drop table if exists public.seller_portfolio_assets;

alter table public.seller_profiles
  drop constraint if exists seller_profiles_display_name_length,
  drop constraint if exists seller_profiles_language_count,
  drop constraint if exists seller_profiles_locality_length;

alter table public.seller_profiles
  add constraint seller_profiles_display_name_length
    check (char_length(trim(display_name)) between 2 and 80),
  add constraint seller_profiles_language_count
    check (cardinality(languages) between 1 and 12),
  add constraint seller_profiles_locality_length
    check (locality is null or char_length(trim(locality)) between 2 and 100);

drop function if exists public.seller_update_public_profile(text,text,integer,text[],uuid,text);
drop function if exists app_private.seller_update_public_profile(text,text,integer,text[],uuid,text);

create function app_private.seller_update_public_profile(
  p_display_name text,
  p_avatar_path text,
  p_headline text,
  p_bio text,
  p_years_experience integer,
  p_languages text[],
  p_island_id uuid,
  p_locality text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_display_name text := trim(coalesce(p_display_name, ''));
  v_avatar_path text := nullif(trim(coalesce(p_avatar_path, '')), '');
  v_languages text[];
begin
  if v_user is null or not app_private.has_role('seller') then
    raise exception 'seller_required';
  end if;
  if char_length(v_display_name) not between 2 and 80 then
    raise exception 'invalid_display_name';
  end if;
  if char_length(trim(coalesce(p_headline, ''))) > 120
     or char_length(trim(coalesce(p_bio, ''))) > 2000 then
    raise exception 'profile_text_too_long';
  end if;
  if p_years_experience not between 0 and 80 then
    raise exception 'invalid_experience';
  end if;

  select coalesce(array_agg(language order by ordinal), array['en-BS']::text[])
  into v_languages
  from (
    select distinct on (lower(trim(value))) trim(value) as language, ordinal
    from unnest(coalesce(p_languages, array['en-BS']::text[])) with ordinality as item(value, ordinal)
    where char_length(trim(value)) between 2 and 40
    order by lower(trim(value)), ordinal
  ) normalized;

  if cardinality(v_languages) not between 1 and 12 then
    raise exception 'invalid_languages';
  end if;
  if p_island_id is not null and not exists (
    select 1 from public.islands where id = p_island_id and active
  ) then
    raise exception 'invalid_island';
  end if;
  if char_length(trim(coalesce(p_locality, ''))) > 100 then
    raise exception 'invalid_locality';
  end if;
  if v_avatar_path is not null and not exists (
    select 1
    from storage.objects
    where bucket_id = 'public-profile-media'
      and name = v_avatar_path
      and owner_id = v_user::text
  ) then
    raise exception 'invalid_profile_photo';
  end if;

  update public.seller_profiles
  set display_name = v_display_name,
      avatar_path = v_avatar_path,
      headline = nullif(trim(coalesce(p_headline, '')), ''),
      bio = nullif(trim(coalesce(p_bio, '')), ''),
      years_experience = p_years_experience,
      languages = v_languages,
      island_id = p_island_id,
      locality = nullif(trim(coalesce(p_locality, '')), ''),
      updated_at = now()
  where user_id = v_user;

  if not found then
    raise exception 'seller_profile_not_found';
  end if;

  update public.profiles
  set display_name = v_display_name,
      avatar_path = v_avatar_path,
      updated_at = now()
  where id = v_user;

  return jsonb_build_object('ok', true, 'avatar_path', v_avatar_path);
end
$function$;

create function public.seller_update_public_profile(
  text,text,text,text,integer,text[],uuid,text
)
returns jsonb
language sql
set search_path = ''
as $function$
  select app_private.seller_update_public_profile($1,$2,$3,$4,$5,$6,$7,$8);
$function$;

revoke all on function app_private.seller_update_public_profile(text,text,text,text,integer,text[],uuid,text) from public, anon;
revoke all on function public.seller_update_public_profile(text,text,text,text,integer,text[],uuid,text) from public, anon;
grant execute on function app_private.seller_update_public_profile(text,text,text,text,integer,text[],uuid,text) to authenticated;
grant execute on function public.seller_update_public_profile(text,text,text,text,integer,text[],uuid,text) to authenticated;

comment on function public.seller_update_public_profile(text,text,text,text,integer,text[],uuid,text)
  is 'Updates the authenticated seller public identity, Care-style profile content, profile photo, languages and Bahamas location.';
