-- Read models. security_invoker keeps RLS in force for callers other than the service role.

create view public.profile_overview
with (security_invoker = true)
as
select
  p.id,
  p.full_name,
  p.photo_path,
  p.profile_url,
  p.status,
  p.status_changed_at,
  p.visibility,
  p.experience_level,
  p.billing_method,
  p.education,
  p.categories,
  p.email,
  p.time_zone,
  p.address,
  p.phone,
  p.created_at,
  p.updated_at,
  v.id as current_version_id,
  v.title,
  (
    select count(*)::int
    from public.contracts c
    where c.profile_id = p.id and c.status = 'active' and c.deleted_at is null
  ) as active_contracts_count,
  greatest(
    p.updated_at,
    p.status_changed_at,
    v.updated_at,
    (select max(d.changed_at) from public.daily_changes d where d.profile_id = p.id)
  ) as last_activity_at
from public.profiles p
left join public.profile_versions v on v.profile_id = p.id and v.is_current;

-- One row per transaction: the unit the UI shows as a single action.
create view public.activity_feed
with (security_invoker = true)
as
select
  l.tx_id,
  min(l.occurred_at) as occurred_at,
  (array_agg(l.action order by l.occurred_at, l.id))[1] as action,
  (array_agg(l.profile_id order by l.occurred_at, l.id)
     filter (where l.profile_id is not null))[1] as profile_id,
  jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'occurred_at', l.occurred_at,
      'tx_id', l.tx_id,
      'profile_id', l.profile_id,
      'entity_type', l.entity_type,
      'entity_id', l.entity_id,
      'action', l.action,
      'details', l.details
    )
    order by l.occurred_at, l.id
  ) as rows
from public.activity_log l
group by l.tx_id;

revoke all on public.profile_overview, public.activity_feed from anon, authenticated;
