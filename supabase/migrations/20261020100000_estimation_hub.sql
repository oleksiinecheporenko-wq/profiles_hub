-- Estimation Hub replaces Profiles Hub in the same project.
-- 1) Remove every Profiles Hub object (tables, views, functions, types).
-- 2) Create the estimates model.
-- The old storage buckets (profile-photos, portfolio-images) are left alone: Supabase
-- does not allow deleting them from SQL; remove them in the dashboard if needed.

-- ---------------------------------------------------------------------------
-- 1. Profiles Hub teardown
-- ---------------------------------------------------------------------------

drop view if exists public.activity_feed;
drop view if exists public.profile_overview;

drop table if exists public.activity_log cascade;
drop table if exists public.contract_comments cascade;
drop table if exists public.contracts cascade;
drop table if exists public.daily_changes cascade;
drop table if exists public.profile_versions cascade;
drop table if exists public.profile_languages cascade;
drop table if exists public.profiles cascade;
drop table if exists public.skill_catalog cascade;

drop function if exists public.create_profile(text, public.profile_status, text, text, text);
drop function if exists public.update_profile_fields(uuid, jsonb);
drop function if exists public.set_profile_languages(uuid, jsonb);
drop function if exists public.change_profile_status(uuid, public.profile_status, text);
drop function if exists public.apply_daily_change(uuid, text, jsonb, timestamptz);
drop function if exists public.create_global_version(uuid, jsonb);
drop function if exists public.edit_global_version(uuid, jsonb, timestamptz);
drop function if exists public.create_contract(uuid, date, text, numeric, text, text);
drop function if exists public.update_contract(uuid, uuid, date, text, numeric, text, text, timestamptz);
drop function if exists public.set_contract_status(uuid, public.contract_status);
drop function if exists public.soft_delete_contract(uuid);
drop function if exists public.add_contract_comment(uuid, text);
drop function if exists public.delete_profile(uuid);
drop function if exists public.log_activity();
drop function if exists public.remember_skills();
drop function if exists public._activity_meta(text, jsonb);
drop function if exists public._migrate_certification(jsonb);
drop function if exists public._assert_version_payload(jsonb);
drop function if exists public._assert_collection(jsonb, text);
drop function if exists public._assert_item(jsonb);
drop function if exists public._jsonb_text_array(jsonb);
drop function if exists public._today_kyiv();

drop type if exists public.profile_status cascade;
drop type if exists public.profile_visibility cascade;
drop type if exists public.experience_level cascade;
drop type if exists public.billing_method cascade;
drop type if exists public.language_level cascade;
drop type if exists public.contract_status cascade;

-- ---------------------------------------------------------------------------
-- 2. Estimates
-- ---------------------------------------------------------------------------

-- in_progress: `Запити` · ready: `Готові запити` · archived: `Архів`
create type public.estimate_status as enum ('in_progress', 'ready', 'archived');

create table public.estimates (
  id              uuid primary key default gen_random_uuid(),
  client_name     text not null check (char_length(btrim(client_name)) between 1 and 200),
  project_name    text check (char_length(project_name) <= 300),
  status          public.estimate_status not null default 'in_progress',
  developer       text check (char_length(developer) <= 200),
  rate            numeric(10, 2) check (rate >= 0),
  job_title       text check (char_length(job_title) <= 500),
  job_description text check (char_length(job_description) <= 50000),
  additional_info text check (char_length(additional_info) <= 50000),
  -- [{id, url, label}]
  links           jsonb not null default '[]' check (jsonb_typeof(links) = 'array'),
  -- [{id, kind: 'phase' | 'task', feature, notes, realistic}] in display order.
  -- Optimistic/Pessimistic are derived (realistic −/+ 6 h), never stored.
  rows            jsonb not null default '[]' check (jsonb_typeof(rows) = 'array'),
  created_at      timestamptz not null default now(),
  ready_at        timestamptz,
  archived_at     timestamptz,
  updated_at      timestamptz not null default now(),
  check ((status = 'in_progress') = (ready_at is null)),
  check ((status = 'archived') = (archived_at is not null)),
  check (status <> 'archived' or rate is not null)
);

create index estimates_status_idx on public.estimates (status, created_at desc);

create table public.estimate_files (
  id          uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  path        text not null unique,
  name        text not null check (char_length(name) between 1 and 300),
  mime_type   text,
  size        bigint check (size >= 0),
  created_at  timestamptz not null default now()
);

create index estimate_files_estimate_idx on public.estimate_files (estimate_id, created_at);

-- updated_at helper (kept from the previous schema if present).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger estimates_set_updated_at
  before update on public.estimates
  for each row execute function public.set_updated_at();

alter table public.estimates enable row level security;
alter table public.estimate_files enable row level security;
revoke all on public.estimates, public.estimate_files from anon, authenticated;

-- Private bucket for job post materials (photos, videos, documents). Files are
-- uploaded straight from the browser through short-lived signed upload URLs and
-- shown through signed download URLs; there are no storage policies.
insert into storage.buckets (id, name, public, file_size_limit)
values ('estimate-materials', 'estimate-materials', false, 52428800)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;
