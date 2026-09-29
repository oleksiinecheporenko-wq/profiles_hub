-- Permanent profile deletion. Versions, daily changes, languages, contracts and their
-- comments go with it (ON DELETE CASCADE). The log triggers record every removed row
-- in the same transaction under `profile.deleted`, so `Дії` keeps one entry with the
-- full snapshot. Returns the storage paths the app should remove afterwards.

create function public.delete_profile(p_profile_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_images  jsonb;
begin
  select * into v_profile from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'profile not found' using errcode = 'UP404';
  end if;

  select coalesce(jsonb_agg(distinct item ->> 'image_path'), '[]'::jsonb) into v_images
  from public.profile_versions v, jsonb_array_elements(v.portfolio) as item
  where v.profile_id = p_profile_id and coalesce(item ->> 'image_path', '') <> '';

  perform set_config('app.action', 'profile.deleted', true);

  delete from public.profiles where id = p_profile_id;

  return jsonb_build_object(
    'full_name', v_profile.full_name,
    'photo_path', v_profile.photo_path,
    'portfolio_images', v_images
  );
end;
$$;

revoke execute on function public.delete_profile(uuid) from public, anon, authenticated;
grant execute on function public.delete_profile(uuid) to service_role;
