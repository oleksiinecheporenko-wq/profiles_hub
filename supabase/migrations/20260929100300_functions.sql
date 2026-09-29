-- Mutations as Postgres functions: each validates its input, sets `app.action`
-- for the activity log and does all its writes in one transaction.
--
-- Errors use custom SQLSTATEs that the app maps to Ukrainian messages:
--   UP404 not found · UP409 conflict (stale expected_updated_at) · UP410 duplicate
--   UP422 invalid input · UP423 daily change on a non-current version

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public._today_kyiv()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Kyiv')::date;
$$;

-- jsonb array of strings -> text[] in array order (non-arrays give '{}').
create function public._jsonb_text_array(p jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(e.value order by e.ord), '{}'::text[])
  from jsonb_array_elements_text(
    case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end
  ) with ordinality as e(value, ord);
$$;

create function public._assert_item(p_item jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_item is null or jsonb_typeof(p_item) <> 'object'
     or coalesce(p_item ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    raise exception 'collection item must be an object with a uuid id' using errcode = 'UP422';
  end if;
end;
$$;

create function public._assert_collection(p_list jsonb, p_field text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_item jsonb;
begin
  if p_list is null then
    return;
  end if;
  if jsonb_typeof(p_list) <> 'array' then
    raise exception '% must be an array', p_field using errcode = 'UP422';
  end if;
  for v_item in select value from jsonb_array_elements(p_list) loop
    perform public._assert_item(v_item);
  end loop;
  if (select count(distinct value ->> 'id') from jsonb_array_elements(p_list))
     <> jsonb_array_length(p_list) then
    raise exception '% has duplicate item ids', p_field using errcode = 'UP422';
  end if;
end;
$$;

create function public._assert_version_payload(p_payload jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_content jsonb := p_payload -> 'content';
begin
  if jsonb_typeof(p_payload) is distinct from 'object'
     or jsonb_typeof(v_content) is distinct from 'object' then
    raise exception 'payload must be {update_date, content}' using errcode = 'UP422';
  end if;
  if v_content ? 'skills' and jsonb_typeof(v_content -> 'skills') <> 'array' then
    raise exception 'skills must be an array' using errcode = 'UP422';
  end if;
  perform public._assert_collection(v_content -> 'portfolio', 'portfolio');
  perform public._assert_collection(v_content -> 'project_catalog', 'project_catalog');
  perform public._assert_collection(v_content -> 'certifications', 'certifications');
  perform public._assert_collection(v_content -> 'employment_history', 'employment_history');
  perform public._assert_collection(v_content -> 'other_experiences', 'other_experiences');
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create function public.create_profile(
  p_full_name   text,
  p_status      public.profile_status default 'active',
  p_title       text default null,
  p_profile_url text default null,
  p_photo_path  text default null
)
returns public.profiles
language plpgsql
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'full_name is required' using errcode = 'UP422';
  end if;

  perform set_config('app.action', 'profile.created', true);

  insert into public.profiles (full_name, status, profile_url, photo_path)
  values (
    btrim(p_full_name),
    coalesce(p_status, 'active'),
    nullif(btrim(p_profile_url), ''),
    nullif(p_photo_path, '')
  )
  returning * into v_profile;

  -- The first version is current from the start: exactly one current version exists.
  insert into public.profile_versions (profile_id, update_date, is_current, title)
  values (v_profile.id, public._today_kyiv(), true, nullif(btrim(p_title), ''));

  return v_profile;
end;
$$;

-- Account fields only. Keys absent from the patch are left as is; JSON null clears.
create function public.update_profile_fields(p_profile_id uuid, p_patch jsonb)
returns public.profiles
language plpgsql
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_key text;
begin
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'patch must be an object' using errcode = 'UP422';
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in ('visibility', 'experience_level', 'education', 'categories', 'email',
                     'billing_method', 'time_zone', 'address', 'phone', 'profile_url', 'photo_path') then
      raise exception 'field % cannot be patched', v_key using errcode = 'UP422';
    end if;
  end loop;

  perform set_config('app.action', 'profile.updated', true);

  update public.profiles set
    visibility = case when p_patch ? 'visibility'
      then (p_patch ->> 'visibility')::public.profile_visibility else visibility end,
    experience_level = case when p_patch ? 'experience_level'
      then (p_patch ->> 'experience_level')::public.experience_level else experience_level end,
    billing_method = case when p_patch ? 'billing_method'
      then (p_patch ->> 'billing_method')::public.billing_method else billing_method end,
    education   = case when p_patch ? 'education'   then p_patch ->> 'education'   else education end,
    categories  = case when p_patch ? 'categories'
      then public._jsonb_text_array(p_patch -> 'categories') else categories end,
    email       = case when p_patch ? 'email'       then p_patch ->> 'email'       else email end,
    time_zone   = case when p_patch ? 'time_zone'   then p_patch ->> 'time_zone'   else time_zone end,
    address     = case when p_patch ? 'address'     then p_patch ->> 'address'     else address end,
    phone       = case when p_patch ? 'phone'       then p_patch ->> 'phone'       else phone end,
    profile_url = case when p_patch ? 'profile_url' then p_patch ->> 'profile_url' else profile_url end,
    photo_path  = case when p_patch ? 'photo_path'  then p_patch ->> 'photo_path'  else photo_path end
  where id = p_profile_id
  returning * into v_profile;

  if not found then
    raise exception 'profile not found' using errcode = 'UP404';
  end if;
  return v_profile;
end;
$$;

-- Replaces the profile's languages with the given ordered list.
-- Unchanged rows are left alone, so the log only shows real changes.
create function public.set_profile_languages(p_profile_id uuid, p_languages jsonb)
returns setof public.profile_languages
language plpgsql
set search_path = ''
as $$
begin
  if jsonb_typeof(p_languages) is distinct from 'array' then
    raise exception 'languages must be an array' using errcode = 'UP422';
  end if;
  if (select count(distinct btrim(value ->> 'language')) from jsonb_array_elements(p_languages))
     <> jsonb_array_length(p_languages) then
    raise exception 'duplicate language' using errcode = 'UP410';
  end if;

  perform 1 from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'profile not found' using errcode = 'UP404';
  end if;

  perform set_config('app.action', 'profile.languages_updated', true);

  delete from public.profile_languages l
  where l.profile_id = p_profile_id
    and l.language not in (
      select btrim(value ->> 'language') from jsonb_array_elements(p_languages));

  insert into public.profile_languages (profile_id, language, level, position)
  select
    p_profile_id,
    btrim(e.value ->> 'language'),
    (e.value ->> 'level')::public.language_level,
    (e.ord - 1)::int
  from jsonb_array_elements(p_languages) with ordinality as e(value, ord)
  on conflict (profile_id, language) do update
    set level = excluded.level, position = excluded.position
    where public.profile_languages.level is distinct from excluded.level
       or public.profile_languages.position is distinct from excluded.position;

  return query
    select * from public.profile_languages where profile_id = p_profile_id order by position;
end;
$$;

create function public.change_profile_status(
  p_profile_id uuid,
  p_new_status public.profile_status,
  p_reason     text default null
)
returns public.profiles
language plpgsql
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'profile not found' using errcode = 'UP404';
  end if;
  if v_profile.status = p_new_status then
    return v_profile;
  end if;

  perform set_config('app.action', 'profile.status_changed', true);
  perform set_config('app.reason', coalesce(nullif(btrim(p_reason), ''), ''), true);

  update public.profiles
  set status = p_new_status, status_changed_at = now()
  where id = p_profile_id
  returning * into v_profile;

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------------
-- Versions
-- ---------------------------------------------------------------------------

-- p_change by field:
--   title | description   {"value": text|null}
--   rate                  {"value": number|null}
--   skills                {"value": [text]}
--   collections           {"op":"add","item":{...},"index"?:int}
--                         {"op":"update","item":{...}}
--                         {"op":"remove","item_id":uuid}
--                         {"op":"reorder","ids":[uuid]}
create function public.apply_daily_change(
  p_version_id          uuid,
  p_field               text,
  p_change              jsonb,
  p_expected_updated_at timestamptz
)
returns public.profile_versions
language plpgsql
set search_path = ''
as $$
declare
  v           public.profile_versions;
  v_old       jsonb;
  v_new       jsonb;
  v_list      jsonb;
  v_next      jsonb;
  v_item      jsonb;
  v_item_id   text;
  v_idx       int;
  v_len       int;
  v_ids       jsonb;
  v_op        text;
  v_type      text;
  v_rec_item  uuid;
  v_rec_old   jsonb;
  v_rec_new   jsonb;
begin
  select * into v from public.profile_versions where id = p_version_id for update;
  if not found then
    raise exception 'version not found' using errcode = 'UP404';
  end if;
  if not v.is_current then
    raise exception 'daily changes apply only to the current version' using errcode = 'UP423';
  end if;
  if p_expected_updated_at is null or v.updated_at <> p_expected_updated_at then
    raise exception 'version changed since it was loaded' using errcode = 'UP409';
  end if;
  if jsonb_typeof(p_change) is distinct from 'object' then
    raise exception 'change must be an object' using errcode = 'UP422';
  end if;

  perform set_config('app.action', 'version.daily_change', true);

  -- Scalar fields and skills: one `update` record with old and new values.
  if p_field in ('title', 'description', 'rate', 'skills') then
    v_new := coalesce(p_change -> 'value', 'null'::jsonb);
    if (p_field in ('title', 'description') and jsonb_typeof(v_new) not in ('string', 'null'))
       or (p_field = 'rate' and jsonb_typeof(v_new) not in ('number', 'null'))
       or (p_field = 'skills' and jsonb_typeof(v_new) <> 'array') then
      raise exception 'invalid value for %', p_field using errcode = 'UP422';
    end if;

    v_old := to_jsonb(v) -> p_field;

    update public.profile_versions set
      title       = case when p_field = 'title' then nullif(v_new #>> '{}', '') else title end,
      description = case when p_field = 'description' then nullif(v_new #>> '{}', '') else description end,
      rate        = case when p_field = 'rate' then (v_new #>> '{}')::numeric else rate end,
      skills      = case when p_field = 'skills' then public._jsonb_text_array(v_new) else skills end
    where id = v.id
      and (to_jsonb(profile_versions) -> p_field) is distinct from
          (case p_field
             when 'rate' then to_jsonb((v_new #>> '{}')::numeric(10, 2))
             when 'skills' then to_jsonb(public._jsonb_text_array(v_new))
             else to_jsonb(nullif(v_new #>> '{}', ''))
           end)
    returning * into v;

    if not found then
      -- Same value: nothing to record.
      select * into v from public.profile_versions where id = p_version_id;
      return v;
    end if;

    insert into public.daily_changes (version_id, profile_id, field, change_type, old_value, new_value)
    values (v.id, v.profile_id, p_field, 'update', v_old, to_jsonb(v) -> p_field);
    return v;
  end if;

  if p_field not in ('portfolio', 'project_catalog', 'certifications', 'employment_history',
                     'other_experiences') then
    raise exception 'unknown field %', p_field using errcode = 'UP422';
  end if;

  -- Collections are edited item by item.
  v_list := to_jsonb(v) -> p_field;
  v_len := jsonb_array_length(v_list);
  v_op := p_change ->> 'op';

  if v_op = 'add' then
    v_item := p_change -> 'item';
    perform public._assert_item(v_item);
    v_item_id := v_item ->> 'id';
    if exists (select 1 from jsonb_array_elements(v_list) e where e.value ->> 'id' = v_item_id) then
      raise exception 'item % already exists', v_item_id using errcode = 'UP422';
    end if;
    v_idx := greatest(0, least(coalesce((p_change ->> 'index')::int, v_len), v_len));
    v_next := case when v_idx = v_len
      then v_list || jsonb_build_array(v_item)
      else jsonb_insert(v_list, array[v_idx::text], v_item)
    end;
    -- A new item has no former value.
    v_type := 'add'; v_rec_item := v_item_id::uuid; v_rec_old := null; v_rec_new := v_item;

  elsif v_op = 'update' then
    v_item := p_change -> 'item';
    perform public._assert_item(v_item);
    v_item_id := v_item ->> 'id';
    select (e.ord - 1)::int, e.value into v_idx, v_rec_old
    from jsonb_array_elements(v_list) with ordinality as e(value, ord)
    where e.value ->> 'id' = v_item_id;
    if v_idx is null then
      raise exception 'item % not found', v_item_id using errcode = 'UP404';
    end if;
    if v_rec_old = v_item then
      return v;
    end if;
    v_next := jsonb_set(v_list, array[v_idx::text], v_item);
    v_type := 'update'; v_rec_item := v_item_id::uuid; v_rec_new := v_item;

  elsif v_op = 'remove' then
    v_item_id := p_change ->> 'item_id';
    select e.value into v_rec_old
    from jsonb_array_elements(v_list) as e(value)
    where e.value ->> 'id' = v_item_id;
    if v_rec_old is null then
      raise exception 'item % not found', v_item_id using errcode = 'UP404';
    end if;
    select coalesce(jsonb_agg(e.value order by e.ord), '[]'::jsonb) into v_next
    from jsonb_array_elements(v_list) with ordinality as e(value, ord)
    where e.value ->> 'id' <> v_item_id;
    v_type := 'remove'; v_rec_item := v_item_id::uuid; v_rec_new := null;

  elsif v_op = 'reorder' then
    v_ids := p_change -> 'ids';
    if jsonb_typeof(v_ids) is distinct from 'array'
       or jsonb_array_length(v_ids) <> v_len
       or (select count(distinct x) from jsonb_array_elements_text(v_ids) as x) <> v_len
       or exists (
            select 1 from jsonb_array_elements_text(v_ids) as x
            where not exists (select 1 from jsonb_array_elements(v_list) e where e.value ->> 'id' = x))
    then
      raise exception 'reorder ids must be a permutation of the current items' using errcode = 'UP422';
    end if;
    select coalesce(jsonb_agg(e.value -> 'id' order by e.ord), '[]'::jsonb) into v_rec_old
    from jsonb_array_elements(v_list) with ordinality as e(value, ord);
    if v_rec_old = v_ids then
      return v;
    end if;
    select jsonb_agg(e.value order by r.ord) into v_next
    from jsonb_array_elements_text(v_ids) with ordinality as r(id, ord)
    join jsonb_array_elements(v_list) as e(value) on e.value ->> 'id' = r.id;
    v_type := 'reorder'; v_rec_item := null; v_rec_new := v_ids;

  else
    raise exception 'unknown op %', coalesce(v_op, 'null') using errcode = 'UP422';
  end if;

  execute format('update public.profile_versions set %I = $1 where id = $2 returning *', p_field)
    into v
    using v_next, v.id;

  insert into public.daily_changes (version_id, profile_id, field, change_type, item_id, old_value, new_value)
  values (v.id, v.profile_id, p_field, v_type, v_rec_item, v_rec_old, v_rec_new);

  return v;
end;
$$;

-- p_payload: {"update_date": "yyyy-mm-dd", "content": {title, rate, description, skills,
--             portfolio, project_catalog, certifications, employment_history,
--             other_experiences, additional_info}}
create function public.create_global_version(p_profile_id uuid, p_payload jsonb)
returns public.profile_versions
language plpgsql
set search_path = ''
as $$
declare
  v public.profile_versions;
  c jsonb := p_payload -> 'content';
begin
  perform public._assert_version_payload(p_payload);

  -- Serializes concurrent version creation for the profile.
  perform 1 from public.profiles where id = p_profile_id for update;
  if not found then
    raise exception 'profile not found' using errcode = 'UP404';
  end if;

  perform set_config('app.action', 'version.created', true);

  update public.profile_versions
  set is_current = false
  where profile_id = p_profile_id and is_current;

  insert into public.profile_versions (
    profile_id, update_date, is_current, title, rate, description, skills, portfolio,
    project_catalog, certifications, employment_history, other_experiences, additional_info
  )
  values (
    p_profile_id,
    coalesce((p_payload ->> 'update_date')::date, public._today_kyiv()),
    true,
    nullif(btrim(c ->> 'title'), ''),
    (c ->> 'rate')::numeric,
    nullif(c ->> 'description', ''),
    public._jsonb_text_array(c -> 'skills'),
    coalesce(c -> 'portfolio', '[]'::jsonb),
    coalesce(c -> 'project_catalog', '[]'::jsonb),
    coalesce(c -> 'certifications', '[]'::jsonb),
    coalesce(c -> 'employment_history', '[]'::jsonb),
    coalesce(c -> 'other_experiences', '[]'::jsonb),
    nullif(c ->> 'additional_info', '')
  )
  returning * into v;

  return v;
end;
$$;

-- Edits any version, current or archived. Logged as version.edited; no daily_changes.
create function public.edit_global_version(
  p_version_id          uuid,
  p_payload             jsonb,
  p_expected_updated_at timestamptz
)
returns public.profile_versions
language plpgsql
set search_path = ''
as $$
declare
  v public.profile_versions;
  c jsonb := p_payload -> 'content';
begin
  perform public._assert_version_payload(p_payload);

  select * into v from public.profile_versions where id = p_version_id for update;
  if not found then
    raise exception 'version not found' using errcode = 'UP404';
  end if;
  if p_expected_updated_at is null or v.updated_at <> p_expected_updated_at then
    raise exception 'version changed since it was loaded' using errcode = 'UP409';
  end if;

  perform set_config('app.action', 'version.edited', true);

  update public.profile_versions set
    update_date        = coalesce((p_payload ->> 'update_date')::date, update_date),
    title              = nullif(btrim(c ->> 'title'), ''),
    rate               = (c ->> 'rate')::numeric,
    description        = nullif(c ->> 'description', ''),
    skills             = public._jsonb_text_array(c -> 'skills'),
    portfolio          = coalesce(c -> 'portfolio', '[]'::jsonb),
    project_catalog    = coalesce(c -> 'project_catalog', '[]'::jsonb),
    certifications     = coalesce(c -> 'certifications', '[]'::jsonb),
    employment_history = coalesce(c -> 'employment_history', '[]'::jsonb),
    other_experiences  = coalesce(c -> 'other_experiences', '[]'::jsonb),
    additional_info    = nullif(c ->> 'additional_info', '')
  where id = p_version_id
  returning * into v;

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------------

create function public.create_contract(
  p_profile_id   uuid,
  p_created_date date,
  p_title        text,
  p_rate         numeric default null,
  p_description  text default null,
  p_dialog       text default null
)
returns public.contracts
language plpgsql
set search_path = ''
as $$
declare
  v_contract public.contracts;
begin
  if p_title is null or btrim(p_title) = '' then
    raise exception 'title is required' using errcode = 'UP422';
  end if;
  perform 1 from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'profile not found' using errcode = 'UP404';
  end if;

  perform set_config('app.action', 'contract.created', true);

  insert into public.contracts (profile_id, created_date, title, rate, description, dialog)
  values (p_profile_id, coalesce(p_created_date, public._today_kyiv()), btrim(p_title), p_rate,
          nullif(p_description, ''), nullif(p_dialog, ''))
  returning * into v_contract;

  return v_contract;
end;
$$;

create function public.update_contract(
  p_contract_id         uuid,
  p_profile_id          uuid,
  p_created_date        date,
  p_title               text,
  p_rate                numeric default null,
  p_description         text default null,
  p_dialog              text default null,
  p_expected_updated_at timestamptz default null
)
returns public.contracts
language plpgsql
set search_path = ''
as $$
declare
  v_contract public.contracts;
begin
  if p_title is null or btrim(p_title) = '' then
    raise exception 'title is required' using errcode = 'UP422';
  end if;

  select * into v_contract from public.contracts
  where id = p_contract_id and deleted_at is null
  for update;
  if not found then
    raise exception 'contract not found' using errcode = 'UP404';
  end if;
  if p_expected_updated_at is not null and v_contract.updated_at <> p_expected_updated_at then
    raise exception 'contract changed since it was loaded' using errcode = 'UP409';
  end if;
  perform 1 from public.profiles where id = p_profile_id;
  if not found then
    raise exception 'profile not found' using errcode = 'UP404';
  end if;

  perform set_config('app.action', 'contract.edited', true);

  update public.contracts set
    profile_id   = p_profile_id,
    created_date = coalesce(p_created_date, created_date),
    title        = btrim(p_title),
    rate         = p_rate,
    description  = nullif(p_description, ''),
    dialog       = nullif(p_dialog, '')
  where id = p_contract_id
  returning * into v_contract;

  return v_contract;
end;
$$;

create function public.set_contract_status(p_contract_id uuid, p_status public.contract_status)
returns public.contracts
language plpgsql
set search_path = ''
as $$
declare
  v_contract public.contracts;
begin
  select * into v_contract from public.contracts
  where id = p_contract_id and deleted_at is null
  for update;
  if not found then
    raise exception 'contract not found' using errcode = 'UP404';
  end if;
  if v_contract.status = p_status then
    return v_contract;
  end if;

  perform set_config('app.action',
    case when p_status = 'closed' then 'contract.closed' else 'contract.reopened' end, true);

  update public.contracts
  set status = p_status,
      closed_at = case when p_status = 'closed' then now() else null end
  where id = p_contract_id
  returning * into v_contract;

  return v_contract;
end;
$$;

create function public.soft_delete_contract(p_contract_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('app.action', 'contract.deleted', true);

  update public.contracts
  set deleted_at = now()
  where id = p_contract_id and deleted_at is null;

  if not found then
    raise exception 'contract not found' using errcode = 'UP404';
  end if;
end;
$$;

create function public.add_contract_comment(p_contract_id uuid, p_body text)
returns public.contract_comments
language plpgsql
set search_path = ''
as $$
declare
  v_comment public.contract_comments;
begin
  if p_body is null or btrim(p_body) = '' then
    raise exception 'comment is empty' using errcode = 'UP422';
  end if;
  perform 1 from public.contracts where id = p_contract_id and deleted_at is null;
  if not found then
    raise exception 'contract not found' using errcode = 'UP404';
  end if;

  perform set_config('app.action', 'contract.comment_added', true);

  insert into public.contract_comments (contract_id, body)
  values (p_contract_id, p_body)
  returning * into v_comment;

  return v_comment;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: only the service role may call functions.
-- (Trigger functions need no EXECUTE grant to fire.)
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
