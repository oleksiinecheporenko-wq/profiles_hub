-- Adds `details.meta` to activity log rows: identifying context of the entity that an
-- UPDATE alone does not carry (a version's date, a contract's title, …), so the feed
-- can render summaries such as «Відредаговано версію від 12.08.2026».
--   profile          {full_name}
--   profile_language {language}
--   version          {update_date}
--   contract         {title}
--   contract_comment {contract_title}

create or replace function public._activity_meta(p_entity text, p_row jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case p_entity
    when 'profile' then jsonb_build_object('full_name', p_row ->> 'full_name')
    when 'profile_language' then jsonb_build_object('language', p_row ->> 'language')
    when 'version' then jsonb_build_object('update_date', p_row ->> 'update_date')
    when 'contract' then jsonb_build_object('title', p_row ->> 'title')
    when 'contract_comment' then jsonb_build_object(
      'contract_title',
      (select c.title from public.contracts c where c.id = (p_row ->> 'contract_id')::uuid))
    else '{}'::jsonb
  end;
$$;

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity    text := tg_argv[0];
  v_action    text := nullif(current_setting('app.action', true), '');
  v_reason    text := nullif(current_setting('app.reason', true), '');
  v_old       jsonb;
  v_new       jsonb;
  v_row       jsonb;
  v_changes   jsonb := '{}'::jsonb;
  v_details   jsonb;
  v_profile   uuid;
  v_key       text;
begin
  if current_setting('app.skip_log', true) = 'on' then
    return null;
  end if;

  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  v_row := coalesce(v_new, v_old);

  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key <> 'updated_at' and (v_old -> v_key) is distinct from (v_new -> v_key) then
        v_changes := v_changes || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return null;
    end if;
    v_details := jsonb_build_object('changes', v_changes);
  else
    v_details := jsonb_build_object('row', v_row);
  end if;

  if v_reason is not null then
    v_details := v_details || jsonb_build_object('reason', v_reason);
  end if;
  v_details := v_details || jsonb_build_object('meta', public._activity_meta(v_entity, v_row));

  v_profile := case v_entity
    when 'profile' then (v_row ->> 'id')::uuid
    when 'contract_comment' then (
      select c.profile_id from public.contracts c where c.id = (v_row ->> 'contract_id')::uuid)
    else (v_row ->> 'profile_id')::uuid
  end;

  if v_action is null then
    v_action := case v_entity
      when 'profile' then case tg_op
        when 'INSERT' then 'profile.created'
        when 'DELETE' then 'profile.deleted'
        else case when v_changes ? 'status' then 'profile.status_changed' else 'profile.updated' end
      end
      when 'profile_language' then 'profile.languages_updated'
      when 'version' then case tg_op
        when 'INSERT' then 'version.created'
        when 'DELETE' then 'version.deleted'
        else 'version.edited'
      end
      when 'contract' then case tg_op
        when 'INSERT' then 'contract.created'
        when 'DELETE' then 'contract.deleted'
        else case
          when v_changes ? 'deleted_at' and v_new ->> 'deleted_at' is not null then 'contract.deleted'
          when v_changes ? 'status' and v_new ->> 'status' = 'closed' then 'contract.closed'
          when v_changes ? 'status' then 'contract.reopened'
          else 'contract.edited'
        end
      end
      when 'contract_comment' then 'contract.comment_added'
      else v_entity || '.' || lower(tg_op)
    end;
  end if;

  insert into public.activity_log (profile_id, entity_type, entity_id, action, details)
  values (v_profile, v_entity, (v_row ->> 'id')::uuid, v_action, v_details);

  return null;
end;
$$;

-- Backfill rows written before this migration, from the entities' current state.
update public.activity_log l
set details = l.details || jsonb_build_object('meta', m.meta)
from (
  select a.id,
    case a.entity_type
      when 'profile' then (select jsonb_build_object('full_name', p.full_name) from public.profiles p where p.id = a.entity_id)
      when 'profile_language' then jsonb_build_object('language', coalesce(a.details #>> '{row,language}', (select pl.language from public.profile_languages pl where pl.id = a.entity_id)))
      when 'version' then (select jsonb_build_object('update_date', v.update_date) from public.profile_versions v where v.id = a.entity_id)
      when 'contract' then (select jsonb_build_object('title', c.title) from public.contracts c where c.id = a.entity_id)
      when 'contract_comment' then (
        select jsonb_build_object('contract_title', c.title)
        from public.contract_comments cc join public.contracts c on c.id = cc.contract_id
        where cc.id = a.entity_id)
    end as meta
  from public.activity_log a
  where not (a.details ? 'meta')
) m
where l.id = m.id and m.meta is not null;

revoke execute on function public._activity_meta(text, jsonb) from public, anon, authenticated;
grant execute on function public._activity_meta(text, jsonb) to service_role;
