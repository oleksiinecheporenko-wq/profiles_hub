-- Skill catalog: every skill ever saved in any version, for autocomplete.
-- Filled by a trigger on profile_versions (global updates, edits and daily changes
-- all write the skills column), never pruned: a skill stays suggestible after it is
-- removed from every profile. Unique case-insensitively; the first spelling wins.

create table public.skill_catalog (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create unique index skill_catalog_name_idx on public.skill_catalog (lower(btrim(name)));

alter table public.skill_catalog enable row level security;
revoke all on public.skill_catalog from anon, authenticated;

create function public.remember_skills()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.skills is not distinct from old.skills then
    return null;
  end if;
  insert into public.skill_catalog (name)
  select distinct on (lower(btrim(s))) btrim(s)
  from unnest(new.skills) as s
  where btrim(s) <> ''
  on conflict ((lower(btrim(name)))) do nothing;
  return null;
end;
$$;

create trigger profile_versions_remember_skills
  after insert or update of skills on public.profile_versions
  for each row execute function public.remember_skills();

-- Backfill from existing versions.
insert into public.skill_catalog (name)
select distinct on (lower(btrim(s))) btrim(s)
from public.profile_versions v, unnest(v.skills) as s
where btrim(s) <> ''
on conflict ((lower(btrim(name)))) do nothing;
