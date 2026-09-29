-- Activity log written by triggers, so every change is recorded, including edits made
-- directly in the Supabase dashboard.
--
-- RPC functions set transaction-local context before writing:
--   set_config('app.action', 'profile.status_changed', true)
--   set_config('app.reason', '<text>', true)            -- optional
-- Without context the trigger derives a generic action from the table and operation.
-- One user action may write several rows; the UI groups them by tx_id.
--
-- `app.skip_log = on` (session setting) disables logging; used only by seed.sql,
-- which inserts its own historical log rows.

create function public.log_activity()
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
    -- Nothing but updated_at changed: nothing to record.
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

create trigger profiles_log
  after insert or update or delete on public.profiles
  for each row execute function public.log_activity('profile');

create trigger profile_languages_log
  after insert or update or delete on public.profile_languages
  for each row execute function public.log_activity('profile_language');

create trigger profile_versions_log
  after insert or update or delete on public.profile_versions
  for each row execute function public.log_activity('version');

create trigger contracts_log
  after insert or update or delete on public.contracts
  for each row execute function public.log_activity('contract');

create trigger contract_comments_log
  after insert or update or delete on public.contract_comments
  for each row execute function public.log_activity('contract_comment');
