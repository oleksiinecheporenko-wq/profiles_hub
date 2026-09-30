-- Certifications: one `date` becomes a period (`date_from`, `date_to`) and the link
-- field is replaced by a free-text `description`.
--   old item: {id, title, issuer, date, url}
--   new item: {id, title, issuer, date_from, date_to, description}
-- Existing items keep their data: date -> date_from, url -> description (so nothing
-- entered before is lost). History (daily_changes, activity_log) keeps the old shape.

create function public._migrate_certification(p_item jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_item ? 'date_from' or p_item ? 'description' then p_item
    else jsonb_build_object(
      'id', p_item -> 'id',
      'title', p_item -> 'title',
      'issuer', coalesce(p_item -> 'issuer', 'null'::jsonb),
      'date_from', coalesce(p_item -> 'date', 'null'::jsonb),
      'date_to', 'null'::jsonb,
      'description', coalesce(p_item -> 'url', 'null'::jsonb)
    )
  end;
$$;

-- A data migration, not a user action: keep it out of the activity log.
select set_config('app.skip_log', 'on', true);

update public.profile_versions v
set certifications = (
  select coalesce(jsonb_agg(public._migrate_certification(e.item) order by e.ord), '[]'::jsonb)
  from jsonb_array_elements(v.certifications) with ordinality as e(item, ord)
)
where jsonb_array_length(v.certifications) > 0;

select set_config('app.skip_log', '', true);

revoke execute on function public._migrate_certification(jsonb) from public, anon, authenticated;
