begin;

-- Favorites are private buyer bookmarks, never proof of verification or hiring.
drop policy if exists favorites_owner on public.favorites;
create policy favorites_buyer_read on public.favorites for select to authenticated
using(buyer_id=(select auth.uid()) and app_private.has_role('buyer'));
revoke insert,update,delete on public.favorites from anon,authenticated;
grant select on public.favorites to authenticated;

create function public.set_provider_favorite(p_seller_id uuid,p_favorite boolean)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_user uuid:=auth.uid(); begin
  if v_user is null or not app_private.has_role('buyer') then raise exception 'buyer_required'; end if;
  if p_seller_id is null or p_favorite is null then raise exception 'favorite_choice_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('favorite:'||v_user::text||':'||p_seller_id::text,0));
  if p_favorite then
    if p_seller_id=v_user or not exists(
      select 1 from public.seller_profiles sp join public.profiles p on p.id=sp.user_id
      where sp.user_id=p_seller_id and sp.status='approved' and sp.profile_published_at is not null
        and p.account_status='active' and p.deleted_at is null
    ) or exists(select 1 from public.blocks b where
      (b.blocker_user_id=v_user and b.blocked_user_id=p_seller_id) or
      (b.blocker_user_id=p_seller_id and b.blocked_user_id=v_user))
    then raise exception 'provider_unavailable'; end if;
    insert into public.favorites(buyer_id,seller_id) values(v_user,p_seller_id) on conflict(buyer_id,seller_id) do nothing;
  else
    -- Unpublication or a later block must never trap a bookmark in the list.
    delete from public.favorites where buyer_id=v_user and seller_id=p_seller_id;
  end if;
  return jsonb_build_object('ok',true,'seller_id',p_seller_id,'favorite',p_favorite);
end $$;
revoke all on function public.set_provider_favorite(uuid,boolean) from public,anon;
grant execute on function public.set_provider_favorite(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
