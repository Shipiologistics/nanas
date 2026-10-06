begin;

create or replace function app_private.seller_set_publication(p_published boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_profile public.seller_profiles%rowtype;
  v_published_at timestamptz;
begin
  if v_user is null or not app_private.has_role('seller') then raise exception 'seller_required'; end if;
  if p_published is null then raise exception 'publication_choice_required'; end if;
  select * into v_profile from public.seller_profiles where user_id=v_user for update;
  if not found then raise exception 'seller_profile_required'; end if;
  if p_published then
    if v_profile.status <> 'approved' then raise exception 'provider_approval_required'; end if;
    if char_length(trim(coalesce(v_profile.display_name,''))) < 2
      or char_length(trim(coalesce(v_profile.headline,''))) < 10
      or char_length(trim(coalesce(v_profile.locality,''))) < 2
      or coalesce(cardinality(v_profile.languages),0)=0
      or not exists(select 1 from public.islands where id=v_profile.island_id and active)
    then raise exception 'complete_public_profile_first'; end if;
    if not exists(select 1 from public.seller_services ss join public.services s on s.id=ss.service_id
      where ss.seller_id=v_user and ss.active and s.active and ss.rate_minor>0
        and char_length(trim(coalesce(ss.service_bio,'')))>=180 and cardinality(ss.capabilities)>0)
    then raise exception 'complete_service_profile_first'; end if;
    if not exists(select 1 from public.seller_service_areas sa join public.service_areas a on a.id=sa.service_area_id
      where sa.seller_id=v_user and sa.active and a.active)
    then raise exception 'active_coverage_required'; end if;
    if not exists(select 1 from public.availability_rules where seller_id=v_user and active)
    then raise exception 'availability_required'; end if;
    v_published_at := coalesce(v_profile.profile_published_at,now());
  end if;
  update public.seller_profiles set profile_published_at=v_published_at,updated_at=now() where user_id=v_user;
  if v_profile.profile_published_at is distinct from v_published_at then
    insert into public.domain_events(aggregate_type,aggregate_id,event_type,payload_redacted)
    values('seller_profile',v_user,case when p_published then 'provider.published' else 'provider.unpublished' end,
      jsonb_build_object('published',p_published));
  end if;
  return jsonb_build_object('ok',true,'published_at',v_published_at);
end;
$$;

create or replace function public.seller_set_publication(p_published boolean)
returns jsonb language sql security invoker set search_path=''
as $$ select app_private.seller_set_publication(p_published); $$;
revoke all on function public.seller_set_publication(boolean) from public,anon;
revoke all on function app_private.seller_set_publication(boolean) from public,anon;
grant execute on function public.seller_set_publication(boolean) to authenticated;
grant execute on function app_private.seller_set_publication(boolean) to authenticated;
notify pgrst,'reload schema';
commit;
