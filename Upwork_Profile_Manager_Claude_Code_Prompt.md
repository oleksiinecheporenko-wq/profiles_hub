# Upwork Profile Manager — build prompt for Claude Code

This file has two parts.

- **Part A** (this part): product rules, architecture, database, mutations, screen behavior not covered by the design brief, delivery plan. Part A is authoritative for behavior and data.
- **Part B**: the design brief. It is authoritative for the visual system, layout, shared components and interaction details.

Part B was written before the data model existed, so in several places it says a business rule is missing and asks you not to invent it (the `Дії` page, `Контракти`, the profile-scoped `Журнал дій` and `Контракти` tabs, editing of archived versions, mock-only data). Part A now defines those rules. Where the two disagree on behavior or data, follow Part A. Everything else in Part B applies as written.

Read both parts completely before writing code. Then write a short implementation plan to `docs/PLAN.md` with the phases from section 11 as checkboxes, and work through it phase by phase.

## 1. Product summary

A standalone internal web app for a small team that manages Upwork profiles. It stores account details for each profile, content versions (global updates), day-to-day edits to the current version (daily updates), a side-by-side comparison of versions, profile statuses, a full action log and contracts linked to profiles.

- UI language: Ukrainian. Terms copied from Upwork stay in English, as listed in Part B.
- Desktop only, minimum width 1280px. No mobile layout.
- No login and no dashboard in this version.
- Menu: `Профілі`, `Статус профілів`, `Дії`, `Контракти`.

## 2. Stack

- Next.js (App Router, current stable) with TypeScript in strict mode.
- Styling: Part B tokens as CSS variables, mapped into Tailwind CSS theme. Pick one approach for components and keep it consistent.
- Supabase: Postgres and Storage, `@supabase/supabase-js` v2. Supabase CLI for migrations in `supabase/migrations/*.sql` and sample data in `supabase/seed.sql`.
- Validation: zod schemas shared by forms and server actions.
- Drag and drop reorder: `@dnd-kit`.
- Icons: `lucide-react`. Dates: `date-fns` with the `uk` locale.
- Export: `docx` for Word, `@react-pdf/renderer` for PDF. Bundle a TTF font with Cyrillic glyphs (Inter or Roboto) in `src/assets/fonts` and register it for both exports. Without it Ukrainian text in the PDF renders as empty boxes.
- Tests: Vitest for domain logic, Playwright for one smoke test of the main flow.
- Hosting: Vercel. Export routes run on the Node runtime, not Edge.

## 3. Architecture

- The browser never talks to Supabase. All reads and writes go through server code: Server Components for reads, Server Actions for mutations, Route Handlers for file export.
- The server uses a Supabase client created with the service role key, in a module that starts with `import 'server-only'`. The anon key is not used anywhere.
- Row Level Security is enabled on every table, with no policies for `anon` or `authenticated`. Combined with server-only access, this means the database cannot be read from outside even though the app has no login.
- Data access lives in `src/lib/data/`: a `Repository` interface with two implementations. `supabaseRepository` is used when `SUPABASE_URL` is set. `mockRepository` keeps data in memory for local UI work when it is not set, and the UI shows a small `mock data` label in the sidebar footer in that mode. Components never import Supabase directly.
- Every mutation that touches more than one row runs inside a single Postgres function (RPC), so it is atomic. The list is in section 6.
- Suggested layout:

```
src/app/(app)/profiles/page.tsx
src/app/(app)/profiles/[id]/page.tsx          // tabs via ?tab=, versions via ?version=
src/app/(app)/status-profiles/page.tsx
src/app/(app)/actions/page.tsx
src/app/(app)/contracts/page.tsx
src/app/(app)/contracts/new/page.tsx
src/app/(app)/contracts/[id]/page.tsx
src/app/access/page.tsx
src/app/api/contracts/[id]/export/route.ts
src/components/...                            // shared components from Part B
src/lib/data/{repository.ts,supabase.ts,mock.ts}
src/lib/domain/{versions.ts,diff.ts,dailyChanges.ts,activity.ts}
src/lib/validation/*.ts
src/lib/reference/{languages.ts,timezones.ts}
supabase/migrations/*.sql
supabase/seed.sql
```

## 4. Access without login

- Anyone with the URL can use the app. There are no user accounts.
- Optional shared password: if the env variable `APP_ACCESS_PASSWORD` is set, `middleware.ts` sends visitors without a valid cookie to `/access`. That page has one password field and a button, styled with Part B tokens and nothing else. A correct password sets an httpOnly, secure, signed cookie (signed with `APP_COOKIE_SECRET`) valid for 30 days. If the variable is not set, the gate is off.
- Add `<meta name="robots" content="noindex,nofollow">` and a `robots.txt` that disallows everything.
- Keep nullable `actor_id` columns in the log so accounts can be added later without migrating history. Do not show an author anywhere in the UI yet.

## 5. Database

### Enums

| Enum | Values (DB) | UI labels |
| --- | --- | --- |
| `profile_status` | `active`, `hold`, `ban`, `back_to_developer` | Active, Hold, Ban, Back to Developer |
| `profile_visibility` | `public`, `upwork_only`, `private` | Public, Only Upwork users, Private |
| `experience_level` | `entry`, `intermediate`, `expert` | Entry level, Intermediate, Expert |
| `billing_method` | `card`, `paypal` | Debit or credit card, PayPal |
| `language_level` | `basic`, `conversational`, `fluent`, `native` | Basic, Conversational, Fluent, Native or Bilingual |
| `contract_status` | `active`, `closed` | Активний, Закритий |

### Tables

`profiles`
- `id uuid pk`, `full_name text not null`, `photo_path text`, `profile_url text`
- `status profile_status not null default 'active'`, `status_changed_at timestamptz not null default now()`
- `visibility profile_visibility`, `experience_level experience_level`, `billing_method billing_method`
- `education text`, `categories text[] not null default '{}'`
- `email text`, `time_zone text` (IANA name), `address text`, `phone text`
- `created_at`, `updated_at timestamptz` (trigger keeps `updated_at` current)

`profile_languages`
- `id uuid pk`, `profile_id uuid fk → profiles on delete cascade`, `language text not null`, `level language_level not null`, `position int not null`
- unique `(profile_id, language)`

`profile_versions` — one row per global update. The row always holds the version's final state: daily changes update this row directly, so "final state" needs no replay.
- `id uuid pk`, `profile_id uuid fk`, `update_date date not null`, `is_current boolean not null default false`
- `title text`, `rate numeric(10,2) check (rate >= 0)`, `description text check (char_length(description) <= 5000)`
- `skills text[] not null default '{}' check (cardinality(skills) <= 20)`
- `portfolio jsonb`, `project_catalog jsonb`, `certifications jsonb`, `employment_history jsonb`, `other_experiences jsonb` — all `not null default '[]'` with a check that `jsonb_typeof = 'array'`
- `additional_info text`
- `created_at`, `updated_at`
- partial unique index on `(profile_id) where is_current` so a profile can never have two current versions

Collection items are objects with a stable `id` (uuid). Array order is display order.

| Collection | Item fields |
| --- | --- |
| `portfolio` | `id`, `title`, `description`, `url`, `image_path` |
| `project_catalog` | `id`, `title`, `description`, `price`, `url` |
| `certifications` | `id`, `title`, `issuer`, `date`, `url` |
| `employment_history` | `id`, `company`, `position`, `date_from`, `date_to` (null = по теперішній час), `description` |
| `other_experiences` | `id`, `title`, `description` |

When a new global update is created from the current version, items are copied with their existing `id`. Comparison matches items across versions by `id`. New items get new ids. Validate item shapes with zod on the server before any write.

`daily_changes` — the history shown in `Щоденні оновлення` and in a version's `Історія`.
- `id uuid pk`, `version_id uuid fk → profile_versions`, `profile_id uuid fk`
- `field text not null` (one of `title`, `rate`, `description`, `skills`, `portfolio`, `project_catalog`, `certifications`, `employment_history`, `other_experiences`)
- `change_type text not null` (`update`, `add`, `remove`, `reorder`)
- `item_id uuid` (for collection changes), `old_value jsonb`, `new_value jsonb`
- `changed_at timestamptz not null default now()`

`contracts`
- `id uuid pk`, `profile_id uuid fk`, `created_date date not null default current_date`
- `title text not null`, `rate numeric(10,2)`, `description text`, `dialog text`
- `status contract_status not null default 'active'`, `closed_at timestamptz`
- `deleted_at timestamptz` (soft delete; every list and read filters `deleted_at is null`)
- `created_at`, `updated_at`

`contract_comments`
- `id uuid pk`, `contract_id uuid fk`, `body text not null`, `created_at`, `actor_id uuid null`

`activity_log`
- `id uuid pk`, `occurred_at timestamptz default now()`, `tx_id bigint not null default txid_current()`
- `profile_id uuid null`, `entity_type text` (`profile`, `profile_language`, `version`, `contract`, `contract_comment`), `entity_id uuid`
- `action text not null`, `details jsonb not null default '{}'`, `actor_id uuid null`
- indexes on `(occurred_at desc)`, `(profile_id, occurred_at desc)`, `(tx_id)`

### How the log is written

The log is written by database triggers, so any change is recorded, including edits made directly in the Supabase dashboard.

- AFTER INSERT / UPDATE / DELETE triggers on `profiles`, `profile_languages`, `profile_versions`, `contracts`, `contract_comments` insert into `activity_log`. For updates, `details.changes` holds only the columns that actually changed, as `{column: {old, new}}`, ignoring `updated_at`.
- RPC functions set transaction-local context before writing: `set_config('app.action', 'profile.status_changed', true)` and, where relevant, `set_config('app.reason', reason, true)`. The trigger uses `app.action` as the `action` value and copies `app.reason` into `details.reason`. Without context (a direct edit), the trigger uses a generic action such as `profile.updated`.
- One user action can touch several rows (a new global version also flips `is_current` on the old one). The UI groups log rows by `tx_id` and shows one entry per transaction, labelled by the `app.action` of that transaction.

Actions: `profile.created`, `profile.updated`, `profile.status_changed`, `profile.languages_updated`, `version.created`, `version.edited`, `version.daily_change`, `contract.created`, `contract.edited`, `contract.closed`, `contract.reopened`, `contract.deleted`, `contract.comment_added`.

### View

`profile_overview`: every profile with the current version's `title`, `active_contracts_count` (active, not deleted) and `last_activity_at` = the latest of profile `updated_at`, `status_changed_at`, the current version's `updated_at` and the latest `daily_changes.changed_at`. The profiles list, the status page and the profile header read from this view.

### Storage

A migration creates two private buckets: `profile-photos` and `portfolio-images`. Uploads go through a server action: jpg, png or webp, up to 5 MB, stored under a random name. Images are shown through signed URLs (1 hour) generated on the server. Avatars without a photo show initials.

## 6. Mutations (Postgres functions)

Each function validates input, sets `app.action`, does its writes in one transaction and returns the updated row(s). Server actions validate with zod first, call the function and map database errors to Ukrainian messages.

| Function | What it does |
| --- | --- |
| `create_profile(full_name, status, title, profile_url, photo_path)` | Inserts the profile and its first version with `is_current = true`, `update_date = today`, the given title. |
| `update_profile_fields(profile_id, patch jsonb)` | Account fields only: visibility, experience level, education, categories, email, billing method, time zone, address, phone, profile URL, photo. |
| `set_profile_languages(profile_id, languages jsonb)` | Replaces the language rows for the profile. |
| `change_profile_status(profile_id, new_status, reason)` | Updates status and `status_changed_at`, stores the reason in the log. No-op if the status is unchanged. |
| `apply_daily_change(version_id, field, change jsonb, expected_updated_at)` | Only for the current version. Updates the field, inserts `daily_changes` rows, returns the version. |
| `create_global_version(profile_id, payload jsonb)` | Sets `is_current = false` on the current version and inserts the new one as current. |
| `edit_global_version(version_id, payload jsonb, expected_updated_at)` | Edits any version, current or archived. Logged as `version.edited` with the diff. Creates no `daily_changes`. |
| `create_contract`, `update_contract` | Insert or edit a contract. |
| `set_contract_status(contract_id, status)` | Close (sets `closed_at`) or reopen (clears it). |
| `soft_delete_contract(contract_id)` | Sets `deleted_at`. |
| `add_contract_comment(contract_id, body)` | Inserts a comment. |

Concurrent edits: functions that take `expected_updated_at` raise a `conflict` error if the row changed in the meantime. The UI shows the toast `Дані змінилися. Оновіть сторінку, щоб побачити актуальну версію.` and keeps the user's unsaved input in the form.

### Daily change rules

- `title`, `rate`, `description`: one record, `change_type = update`, old and new values.
- `skills`: one record per save, old and new arrays. The UI renders the difference as added and removed tags.
- Collections are edited item by item: `add` (old value null, new item), `update` (old item, new item), `remove` (old item, new null), `reorder` (old and new lists of ids). Never write a made-up old value for a new item.
- Title, Rate and Description edited in `Основна інформація` go through `apply_daily_change` on the current version, so they show up in the daily history.
- Account fields in `Основна інформація` go through `update_profile_fields` and do not create daily changes.

## 7. Screen behavior that extends Part B

### Global updates and archived versions

- The version rail is ordered by `update_date desc, created_at desc`. The current version is always the one most recently created by `create_global_version`, whatever date the user typed.
- `+ Нове оновлення` opens the form pre-filled from the current version, items keeping their ids. Date defaults to today.
- `Редагувати` is available for the current and for archived versions. This replaces Part B's read-only fallback. When editing an archived version, show one line above the form: `Ви редагуєте архівну версію. Зміни буде записано в Дії.`
- `Історія` in a version = `daily_changes` for that `version_id`, newest first, rendered with `ChangeRecord`.

### Профіль → Журнал дій

The same records as the `Дії` page, filtered by `profile_id`, with the same filters except the profile filter.

### Профіль → Контракти

A live list of this profile's contracts (not deleted), same components as the `Контракти` page without the profile column. `Додати контракт` opens `/contracts/new?profile=<id>` with the profile preselected and locked.

### 03 · Дії

- Header `// activity`, title `03 · Дії`.
- Filters in one row: profile (searchable select), action group (`Профіль`, `Статус`, `Основна інформація`, `Оновлення`, `Контракти`), period (`Сьогодні`, `7 днів`, `30 днів`, custom range), text search over the rendered summary.
- Feed newest first, grouped by day with separators `Сьогодні`, `Вчора`, then `dd.MM.yyyy`. Load 50 entries at a time with a `Показати ще` button or infinite scroll.
- Entry: action icon, time, profile avatar and name linking to the profile, one-line summary. If the entry has changed values, it expands to show `було → стало` per field, using the diff styling from Part B.
- Leave room in the entry layout for a future author avatar, but do not render one.

Summary templates (render in `src/lib/domain/activity.ts`, values in quotes are examples):

| Action | Summary |
| --- | --- |
| `profile.created` | Створено профіль «Іван Петренко» |
| `profile.status_changed` | Статус змінено з Active на Hold. Причина: … |
| `profile.updated` | Змінено поле Email |
| `profile.languages_updated` | Оновлено мови профілю |
| `version.created` | Створено глобальне оновлення від 29.09.2026 |
| `version.edited` | Відредаговано версію від 12.08.2026 (Title, Skills) |
| `version.daily_change` | Rate змінено з $35 на $40 |
| `contract.created` | Створено контракт «…» |
| `contract.edited` | Відредаговано контракт «…» |
| `contract.closed` / `contract.reopened` | Контракт «…» закрито / відкрито знову |
| `contract.deleted` | Видалено контракт «…» |
| `contract.comment_added` | Додано коментар до контракту «…» |

### 04 · Контракти

List:
- Header `// contracts`, title `04 · Контракти`, primary action `+ Додати контракт`.
- Segmented control `Усі` / `Активні` / `Закриті` with counts, a profile filter and search by title.
- Table columns: `Тайтл`, `Профіль` (avatar and name), `Рейт`, `Дата створення`, `Статус`. Newest first. A row opens `/contracts/[id]`.

Create and edit (`/contracts/new`, and edit mode on the detail page use the same form):
- `Профіль` — required, searchable select.
- `Посилання на профіль` — read-only, filled from the selected profile.
- `Дата створення` — date, default today.
- `Тайтл` — required. `Рейт` — number, $. `Опис` — textarea.
- `Діалог` — large auto-growing textarea for pasted correspondence; keep line breaks exactly.
- Footer right: `Скасувати` (asks for confirmation if the form has unsaved input) and `Зберегти`. A new contract starts as `Активний`.
- Comments are added on the detail page after the contract is saved.

Detail (`/contracts/[id]`):
- Header left: title, `ContractStatusBadge`, profile avatar and name with the Upwork link, `Створено dd.MM.yyyy`, and `Закрито dd.MM.yyyy` when closed.
- Header right, in this order: `Редагувати`, `Закрити контракт` (for a closed contract: `Відкрити знову`, both with confirmation), `Завантажити` with a menu `Word (.docx)` / `PDF`, and a `⋯` menu holding `Видалити`.
- `Видалити` asks for confirmation, soft-deletes, returns to the list and shows a toast.
- Body: `Рейт`, `Опис`, `Діалог` (collapsed to about 8 lines with `Показати повністю`), `Коментарі`. Comments are listed oldest first, each with date and time, with an input and `Додати` at the bottom. Adding a comment does not require edit mode.

### Export

`GET /api/contracts/[id]/export?format=docx|pdf` returns a file named `contract-<title-slug>-<yyyy-mm-dd>.<ext>`. A4 page, the text wordmark `UPWORK / PROFILE MANAGER` at the top, then a block with title, status, profile name and link, created and closed dates, rate, and after it the sections `Опис`, `Діалог`, `Коментарі`. Plain black text on white, the Cyrillic font from section 2, preserved line breaks. Test the export with Ukrainian text before calling it done.

### Reference data and formatting

- Languages: a static list of language names in English, as Upwork shows them, in `src/lib/reference/languages.ts`.
- Time zones: `Intl.supportedValuesOf('timeZone')`, shown as `(UTC+03:00) Europe/Kyiv`.
- Timestamps are stored in UTC and displayed in `Europe/Kyiv`. Date `dd.MM.yyyy`, time `HH:mm`.
- Rate is displayed as `$40/год`. Project Catalog price as `$250`.
- Validate URLs (http/https only) and email. Render all user text as text, never as HTML.

## 8. Sample data

`supabase/seed.sql` and the mock repository hold the same sample set: 6 profiles with clearly fictional names spread over all four statuses, 2 to 4 global versions each with a few daily changes (including collection adds and edits), and 5 contracts, some closed, some with comments. No real people's data, no brand names.

## 9. Environment and deploy

`.env.example`:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_ACCESS_PASSWORD=        # optional; empty = no password gate
APP_COOKIE_SECRET=          # required if APP_ACCESS_PASSWORD is set
```

Never commit `.env*` files other than `.env.example`. The service role key must only appear in server-only modules.

`README.md` in Ukrainian, short: run locally with mock data, create a Supabase project, `supabase link`, `supabase db push`, optional `supabase db seed`, set the env variables in Vercel, deploy, turn on the password gate.

## 10. Tests

Vitest:
- comparison diff: scalar fields, skills added and removed, collection items matched by id (changed, added, removed, reordered), the `Тільки відмінності` filter
- daily change builder produces the records described in section 6
- a new global version copies items with the same ids
- zod schemas: 20-skill cap and duplicates, 5000-character description, email, URLs

Playwright smoke test (against the mock repository): create a profile → change Rate in `Основна інформація` → the change appears in `Щоденні оновлення` → create a global update → `Порівняння` marks Rate as changed → change status with a reason → the entry appears in `Дії` → create a contract → close it → the Word export returns a file.

## 11. Delivery phases

Work in this order. After each phase run typecheck, lint and tests, fix what fails, commit with a clear message and tick the phase in `docs/PLAN.md`.

1. Scaffold, tokens, app shell with sidebar and the four routes, shared base components, password gate.
2. Migrations (enums, tables, view, triggers, functions, buckets), seed, `Repository` interface with both implementations.
3. `Профілі` list and `Додати профіль`.
4. Profile page: header, status change, `Основна інформація` with inline editing and languages.
5. `Оновлення → Глобальне оновлення`: version rail, current and archived view, create and edit form, collections with reorder.
6. `Оновлення → Щоденні оновлення` with change history.
7. `Оновлення → Порівняння`.
8. `Статус профілів`: metrics, Kanban and grid, status change with confirmation.
9. `Дії` page and the profile `Журнал дій` tab.
10. `Контракти`: list, create, detail, edit, close and reopen, soft delete, comments, profile tab, Word and PDF export.
11. Acceptance pass from Part B, the tests from section 10, README.

## 12. Final report

When done, report: what was built, how to run it locally and with Supabase, the list of migrations, the env variables, anything that still runs on mock data, and known gaps. Out of scope for this version and should stay out: login and roles, dashboard, mobile layout, integrations (Telegram, GetMany, NetHunt).


---

# Part B — Design brief

## Project and priority

Build an internal desktop web application named **Upwork Profile Manager** for managing Upwork profiles, profile content versions, daily changes, statuses, action history and contracts. It is a standalone product. The interface language is Ukrainian. Keep terminology copied from Upwork in English, including `Title`, `Rate`, `Description`, `Skills`, `Project Catalog`, `Visibility`, `Experience level`, the language levels and the four profile status names.

Use https://coralsoft.io/ as the visual reference. Translate its dark, technical, editorial presentation into an efficient application for daily work. Its numbered sections, restrained `//` metadata, compact figures and interface-like technical fragments are useful references. The website is a visual reference, not a source of profile data or business rules. Do not make the application look like a marketing landing page. Do not introduce unrelated product branding into UI, metadata, mock data or code names. The wordmark in the sidebar is `UPWORK / PROFILE MANAGER` with a small `// internal workspace` label; a custom logo is not required.

The functional rules in this prompt take priority over stylistic examples. If a decorative choice reduces readability, editing speed or comparison accuracy, simplify it. Do not fabricate missing business fields for `Дії` or `Контракти`.

## Delivery approach

1. Inspect the project structure, design tokens, routing, components and data access before editing. Reuse existing conventions where practical.
2. Establish shared tokens and components first. Implement all routes and screen states below with one consistent visual system.
3. Reuse the configured Supabase client if one exists. Otherwise put typed mock data behind a repository/service interface so the UI is usable and can later switch to Supabase without rewriting presentation components. Never put Supabase queries throughout the view layer.
4. Implement actual local interactions, not a set of static screenshots. If persistent backend support is absent, keep changes in a local mock repository during the session and show truthful state. Do not imply that local-only edits are permanently saved.
5. Do not add authentication, a dashboard, or a separate mobile UI in this version. Reserve a small area at the bottom of the sidebar for a future user block, without pretending that login exists.
6. On completion, report what was implemented, how to run it, which data is mock-backed, and any unresolved schema details. Do not present unfinished shells as fully working business flows.

## Visual system: Coralsoft translated to product UI

**Character:** near-black canvas, sharp type hierarchy, thin lines, compact information, muted surfaces, sparing coral accent and short technical labels. Keep data legible for long work sessions. Avoid oversize rounded cards, pill-heavy navigation, gradients, heavy shadows, decorative charts and exaggerated animations.

Starting tokens (adjust if the existing repository contains verified Coralsoft brand variables; these values are working UI tokens, not an official brand guide):

```css
--app-bg: #111111;
--sidebar-bg: #0d0d0e;
--surface-1: #171718;
--surface-2: #1d1d1f;
--surface-hover: #242426;
--border: rgba(255,255,255,.08);
--border-strong: rgba(255,255,255,.14);
--text-primary: #f5f5f3;
--text-secondary: #a5a5a2;
--text-muted: #858580;
--accent: #f47b55;
--accent-hover: #ff8a65;
--accent-soft: rgba(244,123,85,.10);
--positive: #51bc86;
--warning: #d6a44c;
--negative: #e27171;
```

Check actual foreground/background contrast. Muted text must still be readable at 14px. Use a clean sans serif such as Inter or the existing product font for primary UI. Use a monospace face selectively for dates, identifiers, status metadata, `//` labels and diff markers. Do not typeset all Ukrainian content in monospace. Default body text around 14px; major page titles around 26–30px. Ordinary controls 32–36px high, inputs around 40px. Cards and controls generally use 6–8px radius. Keep a visible keyboard focus ring.

The coral accent belongs on primary actions, active navigation, the current version marker, selected tabs and changed comparison rows. Status meaning stays separate: `Active` green, `Hold` amber, `Ban` red, `Back to Developer` coral. Contract badges `Активний` and `Закритий` use a separate consistent semantic treatment. Positive diff is muted green; removed value is muted red. Do not fill whole cards with status color.

Use section numbers sparingly, for example `01 · Профілі`, `02 · Статус профілів`; use `// profile history` or `// current version` as small section metadata. Field groups in a version may have `01 / TITLE`, `02 / RATE`. Avoid repeating `//` at every control. Dense screens should use flat surfaces and separators more often than individual cards.

Hover and focus should be quiet and consistent. Transitions should take roughly 120–180ms. Provide hover, focus, disabled, error, loading and empty states. Respect reduced-motion preferences. Do not use pointer cursor on disabled controls.

## App shell and routes

Fixed collapsible left sidebar: approximately 232px expanded and 68px collapsed. At top show `UPWORK / PROFILE MANAGER` and small `// internal workspace`; when collapsed, use a compact recognizable mark with an accessible name. Navigation uses Lucide or an existing consistent icon set:

1. `Профілі` — `/profiles`
2. `Статус профілів` — `/status-profiles`
3. `Дії` — `/actions`
4. `Контракти` — `/contracts`

Follow the repository's route convention if it differs, keeping the same four destinations. Active item: thin coral left marker, primary text and a faint coral background. Inactive text is muted. The bottom reserved user block may show a neutral placeholder layout, but must not claim a signed-in identity or offer a working logout. Main workspace has about 28–32px horizontal padding and no redundant global top navigation. Desktop first, minimum target width 1280px; comparison must remain readable at 1366px. Horizontal scrolling should be a last resort and should never create independently scrolling comparison documents.

Profile route: `/profiles/[id]` with profile tabs. Deep links should preserve the selected profile; use a predictable route or URL state for tabs/version where sensible. The app must make back navigation reliable.

## Shared components

Create reusable `AppSidebar`, `PageHeader`, `SearchInput`, `FilterSelect`, `ProfileStatusBadge`, `ContractStatusBadge`, `InlineEditableField`, `TagInput`, `SearchableSelect`, `SortableCardList`, `EmptyState`, `ConfirmDialog`, `Toast`, `ProfileAvatar`, `VersionBadge`, `ChangeRecord`, `VersionSelector` and `ComparisonRow` (or well-named equivalents).

`InlineEditableField`: view state shows label, value and subtle pencil. Edit state shows the matching control, save/check and cancel/x. Support text, textarea, number, select, searchable select and tags. Enter saves a single-line edit; Escape cancels. In textarea, Enter inserts a newline. Preserve the prior value on cancel or failed validation; show understandable Ukrainian error text.

`TagInput`: Enter or comma creates a tag; each tag has a remove action. `Skills` has a maximum of 20 with `12 / 20` style count. At 20, disable adding but allow removing. Avoid duplicate tags after trimming and normalization.

`SearchableSelect`: keyboard usable, clear selected option, suitable for languages, time zones and long profile lists. For every collection below, use compact items with add, edit, delete and drag reorder where supported. Provide an accessible non-drag fallback for ordering if feasible.

Use confirmation for deletes, irreversible actions and status changes. Toasts report create, save, delete and failures. Loading skeletons for profile list, profile header, version content and status board; avoid full-page spinners. Empty states use a small icon, one short sentence and one relevant action, never a large illustration. External Upwork links open a new tab with safe link attributes.

## 01 · Профілі — list

Page label `// profiles`, title `01 · Профілі`, optional muted count and right primary action `+ Додати профіль`. Below: search across full name and Title, status filter and, if supported by the data, a compact last-updated sort. Render a flat list/table with subtle row dividers; avoid giant cards. Target 52–60px row height.

Columns: `Профіль` (36px avatar and full name), `Title` (single line with ellipsis and accessible full text), `Статус`, `Оновлено`, `Upwork`, `Дії`. Whole row may open the profile, but actions and external link must work independently. Search/filter empty state should have a clear reset action.

`Додати профіль` opens a 520–560px modal. Fields: `ПІБ`, `Статус` (default `Active`), `Тайтл`, optional `Фото`, optional `Посилання на профіль`. Footer: `Скасувати`, `Створити`. Validate required fields and URL when provided. On creation open the new profile. Its Title becomes the initial current version; exactly one current version exists.

## Profile page

Compact header rather than a hero card. Back link to profiles, small `// profile` metadata, 64px avatar, full name, current Title, Upwork URL and copy action. Clicking the avatar permits upload/change. At right, interactive status badge. Status change opens confirmation with target status and optional `Причина`; only apply after confirmation. Show `Оновлено` with a truthful timestamp. Avoid invented profile ID unless one exists in the data.

Primary underline tabs: `Основна інформація`, `Оновлення`, `Журнал дій`, `Контракти`. Default `Основна інформація`. Numbering may appear in navigation if it helps hierarchy. Preserve the user's context while switching tabs.

### Основна інформація

Roughly 62/38 layout. Left heading `// profile content`: `Title`, `Rate` ($/год numeric), `Description` (X / 5000), `Languages`, `Education`, `Categories`. Right heading `// account details`: `Visibility`, `Experience level`, `Email`, `Billing method`, `Time Zone`, `Address`, `Phone`. Use compact editable rows with separators, not one large card per field.

`Title`, `Rate`, `Description` show a subtle `з Актуальної версії` indicator. Saving one of them updates the current version and creates a daily change record with old/new values, date and time. `Languages` comprises editable rows: searchable language and level (`Basic`, `Conversational`, `Fluent`, `Native or Bilingual`), with `+ Додати мову`. `Visibility`: `Public`, `Only Upwork users`, `Private`. `Experience level`: `Entry level`, `Intermediate`, `Expert`. `Billing method`: `Debit or credit card`, `PayPal`. Time Zone searchable. Categories as tags. Validate email. Do not create a daily content-version change for unrelated account details unless the existing schema explicitly does so.

### Оновлення — nested navigation

Smaller secondary tabs: `Глобальне оновлення`, `Щоденні оновлення`, `Порівняння`; default first. These are subordinate to primary profile tabs. Version logic is central:

- A profile has exactly one current global version.
- Creating a new global update starts with editable fields copied from the current version. After save, the new version is current and the previous current version is archived.
- Daily edits change only the current version. Their records stay attached to the version in which they occurred.
- Archived versions are viewable. A version is displayed and compared in its final state, including all daily changes made while it was current.
- Editing a saved global version, where permitted, is recorded in `Дії`. Never silently overwrite history. If backend rules for archived editing are absent, present archived versions as read-only until those rules are defined.

#### Глобальне оновлення

About 68% content left and 32% sticky version timeline right where room allows. The right rail has `+ Нове оновлення` and versions newest first. Each item: date, one-line Title, daily change count, current marker where applicable; selected state is visible but restrained. Use coral for current, neutral tones for archived.

Left: `Актуальна версія` with `Редагувати`; selecting older item shows `Архівна версія`, its date, read-only content and `Повернутися до актуальної`. Display in this order: `Дата оновлення`, `Title`, `Rate`, `Description`, `Portfolio`, `Skills`, `Project Catalog`, `Certifications`, `Employment history`, `Other experiences`, `Додаткова інформація`, `Історія`. The last section is a read-only rendering of this version's daily change records using the shared `ChangeRecord`.

Creation and allowed editing use one form in the broad left workspace, keeping the version rail visible. Fields above except `Історія`; date defaults to today for a new version. `Description` counter X / 5000. `Skills` maximum 20. Collection item fields:

- `Portfolio`: `Назва`, `Опис`, `Посилання`, `Зображення`.
- `Project Catalog`: `Назва`, `Опис`, `Ціна`, `Посилання`.
- `Certifications`: `Назва`, `Ким видано`, `Дата`, `Посилання`.
- `Employment history`: `Компанія`, `Посада`, `Дати`, `Опис`.
- `Other experiences`: `Назва`, `Опис`.

Each collection supports add, item edit, delete with confirmation and reorder. Keep items compact and labels readable. Footer `Скасувати` and `Зберегти`, with clear validation and unsaved-change handling.

#### Щоденні оновлення

At top: `Зміни вносяться в Актуальну версію від [дата]`. Approximately 64% editable content and 36% sticky change history, with one natural page scroll. Editable: `Title`, `Rate`, `Description`, `Portfolio`, `Skills`, `Project Catalog`, `Certifications`, `Employment history`, `Other experiences`. Collections edit individual items rather than replacing the entire collection by default.

Change history newest first. Each `ChangeRecord`: date, time, field, old value and new value, with subtle `−` muted red and `+` muted green treatments. For long text show at most two lines initially and `Показати повністю`. Record adds, edits, deletes and reorders clearly; do not invent a former value for a new item. Reuse these records in version `Історія`. Avoid large saturated red/green boxes.

#### Порівняння

This screen receives maximum horizontal room. Auto-collapse sidebar to 68px on entering comparison if compatible with app state, while preserving a way to expand it. Compact the profile header but preserve name and navigation. Toolbar: left `VersionSelector`, swap button, right `VersionSelector`, and `Тільки відмінності` toggle. Default previous version on left and current on right; if only one version exists, explain that two versions are needed and offer `Нове оновлення`. Do not compare a version to itself unless the user explicitly selects it; handle that state clearly.

**Critical layout invariant:** render each section as a single shared `ComparisonRow` containing left and right cells. Do not render two separate documents with separate scroll positions. One parent vertical scroll, one row height per field, same order on both sides. Preserve alignment even when one description is much longer. At 1366px, labels and values remain readable.

Order: `Title`, `Rate`, `Description`, `Portfolio`, `Skills`, `Project Catalog`, `Certifications`, `Employment history`, `Other experiences`, `Додаткова інформація`. Changed row: extremely subtle coral tint, thin coral line and small `Змінено` marker. Equal rows stay neutral. For Skills, mark specific added/removed tags; for collections, mark specific changed items using stable IDs when available, falling back to careful content matching. Do not mark an entire collection changed solely because one item changed. `Тільки відмінності` hides normalized equal rows, including unchanged collection items where appropriate. Comparison uses the final state of each selected version. Swap must exchange selections without changing data.

### Журнал дій

Reuse the global `Дії` page's record rendering and any actual filters, pre-filtered to the open profile. Show available events such as status changes, field edits and global versions only when records exist. There is no profile filter inside this already scoped tab. Data model and complete filter scheme are not supplied: do not fabricate actor, contract or audit fields. Leave an explicit code TODO for missing business rules, not a developer TODO in the UI.

### Контракти

Create the profile-scoped list/empty-state structure using the shared global contract components, without a redundant profile column. Include `Додати контракт` and click-through only if the existing schema and working form/detail route support them. If not, do not show a deceptive live button; use a truthful empty/shell state and a code TODO. Contract data fields are unspecified here.

## 02 · Статус профілів

Header `// overview`, `02 · Статус профілів`, right `+ Додати профіль` reusing the same modal. Four compact horizontal metrics: `Active`, `Hold`, `Ban`, `Back to Developer`; count and optionally derived percentage, small semantic marker and thin rule. Clicking a metric filters profiles. Search by name and Title. View switch `Канбан` / `Сітка`, default Kanban.

Kanban has four columns for those statuses. Compact profile card: avatar, full name, one-line Title, small shared status badge, `у статусі з [дата]`, active contract count only if known. Thin semantic edge. Status dropdown works through the same confirmation dialog with optional `Причина`. If drag and drop is implemented, dropping into a different column opens confirmation and changes state only on confirm; cancel restores the old column. Card click opens profile. Grid view reuses this card and its actions in a responsive desktop grid. No bright full-card fills.

## 03 · Дії

Build the route, header, list/empty-state container and reusable action record presentation so profile actions can feed this page later. The specification does not define a complete record schema or filter rules. If the repository supplies them, use those exact fields. Otherwise show recorded events available from the UI's data layer and avoid invented columns, fake actor identities, or decorative fake activity. Mark missing integration details in code TODOs only.

## 04 · Контракти

Build route, header, list/empty-state container and shared `ContractStatusBadge` (`Активний`, `Закритий`). Reuse a real existing schema if found. Without one, do not invent contract amount, client, dates or workflow; keep the shell honest and ready for extension. Profile-scoped tab uses the same underlying components.

## Data types and implementation boundaries

Define typed models for `Profile`, `ProfileStatus`, `ProfileVersion`, `DailyChange`, `Language`, `PortfolioItem`, `ProjectCatalogItem`, `Certification`, `EmploymentItem`, `OtherExperience`. Define `Action` and `Contract` properties only if supported by the repository/schema or necessary minimal existing event records. Keep display formatting separate from storage. Make version transitions and daily-change logging atomic in the data layer when a backend exists. Use stable IDs for versions and collection items.

Supabase, when configured, is the source of truth. Reuse project credentials and schema; never hardcode secrets. In mock mode, a typed repository returns realistic but clearly sample data. The UI must be testable for creation, editing, cancellation, status confirmation, version creation, history and comparison. Do not fake successful server persistence. Sanitize displayed text and validate links and email.

## Acceptance pass

Check at 1280, 1366, 1440 and 1920px. At 1366px inspect comparison row alignment and scrolling carefully. Verify sidebar expansion, all tabs, inline save/cancel, Enter/Escape, textarea newlines, 20-skill cap, image upload entry point, profile creation and navigation, status confirmation and cancellation, version creation from copied values, current/archived switching, daily history attached to the correct version, comparison swap and only-differences toggle, collection changes, search/filter, empty states, skeletons and toasts.

Check keyboard access, contrast, truncation with long Ukrainian names and Titles, text wrapping, unexpected horizontal overflow, inconsistent status colors, duplicated components and raw backend errors. Finish spacing, typography, separators and interaction states to product quality. The result should feel like an internal Coralsoft-style tool built for repeated use, with the functional behavior above intact.
