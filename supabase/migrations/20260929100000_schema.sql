-- Upwork Profile Manager: enums, tables, indexes, updated_at triggers, RLS.
-- The app talks to the database only from the server with the service role key.
-- RLS is enabled everywhere with no policies for anon/authenticated.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.profile_status as enum ('active', 'hold', 'ban', 'back_to_developer');
create type public.profile_visibility as enum ('public', 'upwork_only', 'private');
create type public.experience_level as enum ('entry', 'intermediate', 'expert');
create type public.billing_method as enum ('card', 'paypal');
create type public.language_level as enum ('basic', 'conversational', 'fluent', 'native');
create type public.contract_status as enum ('active', 'closed');

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null check (char_length(btrim(full_name)) between 1 and 200),
  photo_path        text,
  profile_url       text check (profile_url is null or profile_url ~* '^https?://'),
  status            public.profile_status not null default 'active',
  status_changed_at timestamptz not null default now(),
  visibility        public.profile_visibility,
  experience_level  public.experience_level,
  billing_method    public.billing_method,
  education         text,
  categories        text[] not null default '{}',
  email             text,
  time_zone         text,
  address           text,
  phone             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index profiles_status_idx on public.profiles (status);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profile_languages
-- ---------------------------------------------------------------------------

create table public.profile_languages (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  language   text not null,
  level      public.language_level not null,
  position   int not null,
  unique (profile_id, language)
);

create index profile_languages_profile_idx on public.profile_languages (profile_id, position);

-- ---------------------------------------------------------------------------
-- profile_versions: one row per global update, always holding its final state
-- ---------------------------------------------------------------------------

create table public.profile_versions (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references public.profiles (id) on delete cascade,
  update_date        date not null,
  is_current         boolean not null default false,
  title              text,
  rate               numeric(10, 2) check (rate >= 0),
  description        text check (char_length(description) <= 5000),
  skills             text[] not null default '{}' check (cardinality(skills) <= 20),
  portfolio          jsonb not null default '[]' check (jsonb_typeof(portfolio) = 'array'),
  project_catalog    jsonb not null default '[]' check (jsonb_typeof(project_catalog) = 'array'),
  certifications     jsonb not null default '[]' check (jsonb_typeof(certifications) = 'array'),
  employment_history jsonb not null default '[]' check (jsonb_typeof(employment_history) = 'array'),
  other_experiences  jsonb not null default '[]' check (jsonb_typeof(other_experiences) = 'array'),
  additional_info    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- A profile can never have two current versions.
create unique index profile_versions_one_current_idx
  on public.profile_versions (profile_id) where is_current;

create index profile_versions_rail_idx
  on public.profile_versions (profile_id, update_date desc, created_at desc);

create trigger profile_versions_set_updated_at
  before update on public.profile_versions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- daily_changes
-- ---------------------------------------------------------------------------

create table public.daily_changes (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.profile_versions (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  field       text not null check (field in (
                'title', 'rate', 'description', 'skills', 'portfolio', 'project_catalog',
                'certifications', 'employment_history', 'other_experiences')),
  change_type text not null check (change_type in ('update', 'add', 'remove', 'reorder')),
  item_id     uuid,
  old_value   jsonb,
  new_value   jsonb,
  changed_at  timestamptz not null default now()
);

create index daily_changes_version_idx on public.daily_changes (version_id, changed_at desc);
create index daily_changes_profile_idx on public.daily_changes (profile_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- contracts
-- ---------------------------------------------------------------------------

create table public.contracts (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  created_date date not null default current_date,
  title        text not null check (char_length(btrim(title)) between 1 and 300),
  rate         numeric(10, 2) check (rate >= 0),
  description  text,
  dialog       text,
  status       public.contract_status not null default 'active',
  closed_at    timestamptz,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((status = 'closed') = (closed_at is not null))
);

create index contracts_profile_idx on public.contracts (profile_id) where deleted_at is null;
create index contracts_created_idx on public.contracts (created_date desc, created_at desc)
  where deleted_at is null;

create trigger contracts_set_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- contract_comments
-- ---------------------------------------------------------------------------

create table public.contract_comments (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at  timestamptz not null default now(),
  actor_id    uuid
);

create index contract_comments_contract_idx on public.contract_comments (contract_id, created_at);

-- ---------------------------------------------------------------------------
-- activity_log (written by triggers, see the next migration)
-- No foreign keys: history must outlive the rows it describes.
-- ---------------------------------------------------------------------------

create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  tx_id       bigint not null default txid_current(),
  profile_id  uuid,
  entity_type text not null check (entity_type in (
                'profile', 'profile_language', 'version', 'contract', 'contract_comment')),
  entity_id   uuid,
  action      text not null,
  details     jsonb not null default '{}',
  actor_id    uuid
);

create index activity_log_occurred_idx on public.activity_log (occurred_at desc);
create index activity_log_profile_idx on public.activity_log (profile_id, occurred_at desc);
create index activity_log_tx_idx on public.activity_log (tx_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: on, with no policies. Only the service role reads/writes.
-- ---------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.profile_languages enable row level security;
alter table public.profile_versions  enable row level security;
alter table public.daily_changes     enable row level security;
alter table public.contracts         enable row level security;
alter table public.contract_comments enable row level security;
alter table public.activity_log      enable row level security;

revoke all on
  public.profiles, public.profile_languages, public.profile_versions, public.daily_changes,
  public.contracts, public.contract_comments, public.activity_log
from anon, authenticated;
