begin;

create or replace function app_private.upsert_household_member(
 p_member_id uuid,p_relationship text,p_display_name text,p_date_of_birth date,p_care_notes text,p_active boolean
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_household uuid;v_id uuid:=coalesce(p_member_id,gen_random_uuid());v_today date:=(now() at time zone 'America/Nassau')::date;
begin
 if v_user is null or not app_private.has_role('buyer') then raise exception 'buyer_required'; end if;
 if char_length(trim(coalesce(p_display_name,''))) not between 1 and 80 then raise exception 'invalid_display_name'; end if;
 if char_length(trim(coalesce(p_relationship,''))) not between 1 and 40 then raise exception 'invalid_relationship'; end if;
 if char_length(trim(coalesce(p_care_notes,'')))>4000 then raise exception 'care_notes_too_long'; end if;
 if p_date_of_birth>v_today then raise exception 'future_date_of_birth'; end if;
 if p_active is null then raise exception 'active_choice_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('household:'||v_user::text,0));
 select id into v_household from public.households where owner_user_id=v_user order by created_at,id limit 1 for update;
 if v_household is null then insert into public.households(owner_user_id,name) values(v_user,'My household') returning id into v_household; end if;
 if p_member_id is null then
  insert into public.household_members(id,household_id,relationship,display_name,date_of_birth_private,care_notes_private,active)
  values(v_id,v_household,trim(p_relationship),trim(p_display_name),p_date_of_birth,nullif(trim(coalesce(p_care_notes,'')),''),p_active);
 else
  update public.household_members set relationship=trim(p_relationship),display_name=trim(p_display_name),date_of_birth_private=p_date_of_birth,
   care_notes_private=nullif(trim(coalesce(p_care_notes,'')),''),active=p_active,updated_at=now()
  where id=p_member_id and household_id=v_household;
  if not found then raise exception 'household_member_not_found'; end if;
 end if;
 return jsonb_build_object('ok',true,'member_id',v_id,'household_id',v_household);
end $$;
revoke all on function app_private.upsert_household_member(uuid,text,text,date,text,boolean),
 public.upsert_household_member(uuid,text,text,date,text,boolean) from public,anon;
grant execute on function app_private.upsert_household_member(uuid,text,text,date,text,boolean),
 public.upsert_household_member(uuid,text,text,date,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
