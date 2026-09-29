# Upwork Profile Manager — план реалізації

Джерело вимог: `Upwork_Profile_Manager_Claude_Code_Prompt.md` (Part A — поведінка й дані, Part B — візуальна система).

Після кожної фази: `npm run typecheck`, `npm run lint`, `npm test`, виправити помилки, коміт, позначити фазу тут.

## Рішення, прийняті на старті

- Next.js 16 (App Router). У Next 16 `middleware.ts` перейменовано на `proxy.ts` — парольний шлюз живе в `src/proxy.ts` (Node runtime за замовчуванням).
- Стилі: токени Part B як CSS-змінні в `src/app/globals.css`, змаплені в тему Tailwind v4 (`@theme inline`). Компоненти стилізуються лише утилітами Tailwind + `clsx`.
- Шрифти: Inter (UI) і JetBrains Mono (дати, ідентифікатори, `//`-мітки) через `next/font`.
- Підписаний cookie доступу: `expiry.hmacSHA256(expiry)` на Web Crypto, секрет `APP_COOKIE_SECRET`, 30 днів, httpOnly, secure (у production), sameSite=lax.
- Якщо `APP_ACCESS_PASSWORD` задано, а `APP_COOKIE_SECRET` — ні, шлюз працює «закрито»: вхід неможливий, сторінка `/access` показує помилку конфігурації.

## Фази

- [x] 1. Scaffold, токени, оболонка застосунку з сайдбаром і чотирма маршрутами, базові спільні компоненти, парольний шлюз.
- [x] 2. Міграції (enums, таблиці, view, тригери, функції, buckets), seed, інтерфейс `Repository` з обома реалізаціями.
- [x] 3. `Профілі`: список і `Додати профіль`.
- [x] 4. Сторінка профілю: шапка, зміна статусу, `Основна інформація` з inline-редагуванням і мовами.
- [x] 5. `Оновлення → Глобальне оновлення`: rail версій, актуальна й архівна версії, форма створення/редагування, колекції з reorder.
- [ ] 6. `Оновлення → Щоденні оновлення` з історією змін.
- [ ] 7. `Оновлення → Порівняння`.
- [ ] 8. `Статус профілів`: метрики, Kanban і сітка, зміна статусу з підтвердженням.
- [ ] 9. `Дії` і вкладка профілю `Журнал дій`.
- [ ] 10. `Контракти`: список, створення, деталі, редагування, закриття/відкриття, soft delete, коментарі, вкладка профілю, експорт Word і PDF.
- [ ] 11. Acceptance pass з Part B, тести з розділу 10, README.

## Фаза 1 — що зроблено

- Маршрути: `/profiles`, `/profiles/[id]`, `/status-profiles`, `/actions`, `/contracts`, `/contracts/new`, `/contracts/[id]`, `/access`; `/` → `/profiles`.
- Компоненти (`src/components/`): `AppSidebar` (+ `SidebarProvider` для згортання, потрібного `Порівнянню`), `PageHeader`, `Button`, `Input`/`Textarea`/`Field`, `SearchInput`, `FilterSelect`, `SegmentedControl`, `Tabs`, `ProfileStatusBadge`, `ContractStatusBadge`, `VersionBadge`, `ProfileAvatar`, `EmptyState`, `Skeleton`, `Dialog`, `ConfirmDialog`, `Toast` (провайдер + `useToast`).
- Базові типи й підписи enum-ів: `src/lib/domain/enums.ts`; форматування: `src/lib/format.ts`.
- `robots.txt` (disallow all) і `noindex,nofollow` meta.
- Компоненти, що залежать від даних (`InlineEditableField`, `TagInput`, `SearchableSelect`, `SortableCardList`, `ChangeRecord`, `VersionSelector`, `ComparisonRow`), будуються у фазах, де вони вперше використовуються.

## Фаза 2 — що зроблено

- Міграції (`supabase/migrations/`):
  - `20260929100000_schema.sql` — enums, таблиці, індекси, тригери `updated_at`, RLS без політик, `revoke` для anon/authenticated.
  - `20260929100100_activity_log_triggers.sql` — `log_activity()` і тригери на 5 таблицях; `app.action` / `app.reason` з RPC, generic action для прямих правок, `app.skip_log` лише для seed.
  - `20260929100200_views.sql` — `profile_overview` і `activity_feed` (один рядок на транзакцію), обидва `security_invoker`.
  - `20260929100300_functions.sql` — усі функції з розділу 6; помилки через власні SQLSTATE (`UP404/409/410/422/423`); execute лише для service_role.
  - `20260929100400_storage.sql` — приватні buckets `profile-photos`, `portfolio-images` (jpg/png/webp, 5 MB).
- `src/lib/data/`: `Repository` (`repository.ts`), `SupabaseRepository` (`supabase.ts`, `server-only`), `MockRepository` (`mock.ts`, емулює транзакції з відкатом і тригери журналу), `getRepository()` (`index.ts`).
- Тестові дані: `sample.ts` створює набір, проганяючи реальні операції через `MockRepository` з детермінованим годинником та id; `supabase/seed.sql` генерується з нього (`npm run db:seed:generate`), тест падає, якщо файл застарів.
- Доменна логіка: `domain/dailyChanges.ts`, `domain/versions.ts`; zod-схеми в `validation/`; довідники мов і часових поясів.
- Перевірка SQL: `migrations.test.ts` запускає всі міграції й seed на PGlite (Postgres у WASM) і тестує функції та тригери, зокрема паритет правил щоденних змін між SQL і TypeScript.
- Відхилення: `update_contract` приймає необов’язковий `p_expected_updated_at` (захист від одночасного редагування); `set_profile_languages` робить upsert замість delete+insert, щоб журнал показував лише реальні зміни.

## Фаза 3 — що зроблено

- `/profiles`: таблиця з колонками `Профіль`, `Title`, `Статус`, `Оновлено`, `Upwork`, `Дії` (копіювати посилання, відкрити). Пошук за ПІБ і Title, фільтр статусу, сортування за `Оновлено`; стан фільтрів у URL (`?q=&status=&sort=asc`), тож «назад» їх відновлює. Порожні стани: немає профілів / нічого не знайдено зі скиданням фільтрів. Skeleton під час завантаження.
- `Додати профіль` (`components/profiles/AddProfileDialog.tsx`): ПІБ, Статус, Тайтл, Фото, Посилання; перевірка zod у браузері й на сервері; після створення — toast і перехід на профіль. Та сама кнопка працює на `Статус профілів`.
- Server action `createProfileAction`: фото перевіряється за magic bytes (jpg/png/webp, ≤ 5 МБ), завантажується в `profile-photos` під випадковою назвою; ліміт тіла server actions піднято до 6 МБ.
- Сторінка профілю поки показує лише шапку й вкладки (решта — фаза 4+), щоб перехід після створення працював.
- Сторінки з даними викликають `connection()` (`getRequestRepository`), тож не пререндеряться під час збірки.
- Перевірено в браузері: список із Supabase; створення профілю з фото й без, помилки валідації — у mock-режимі, щоб не засмічувати базу; окремо перевірено Supabase Storage (завантаження, signed URL, закритий публічний доступ, відмова для GIF).

## Фаза 4 — що зроблено

- Шапка профілю (`components/profiles/ProfileHeader.tsx`): назад до списку, аватар 64 px із завантаженням/заміною фото по кліку, ПІБ, Title, посилання з копіюванням, інтерактивний бейдж статусу, `Оновлено`.
- Зміна статусу (`components/profiles/StatusChange.tsx`): меню інших статусів → підтвердження з необов’язковою `Причина` → `change_profile_status`. Компоненти готові для повторного використання в Kanban (фаза 8).
- `Основна інформація` (`components/profiles/MainInfoTab.tsx`), 62/38: Title/Rate/Description з позначкою `з Актуальної версії` йдуть через `apply_daily_change` з `expected_updated_at` (мітка оновлюється після кожного збереження, тож кілька правок поспіль не дають хибного конфлікту); Languages, Education, Categories і всі account-поля — через `update_profile_fields` / `set_profile_languages`.
- Нові спільні компоненти: `InlineEditableField` (text, textarea з лічильником, number, select, searchable, tags; Enter/Escape, Ctrl+Enter у textarea, значення зберігається при скасуванні або помилці), `TagInput` (Enter/кома, дублікати після нормалізації відхиляються, лічильник `12 / 20`), `SearchableSelect` (combobox із клавіатурою), `Menu`.
- Перевірено в браузері (mock): правки Rate/Title/Description, помилка валідації, Escape, перенос рядків, кілька правок поспіль, зміна статусу з причиною, мови, часовий пояс з пошуком, теги, заміна аватара. На Supabase перевірено передачу `updated_at` і конфлікт (`UP409`) без запису даних.
- Відомий нюанс: після заміни фото старий файл лишається в bucket (не видаляється).

## Фаза 5 — що зроблено

- URL-стан вкладки: `?tab=updates&sub=global|daily|compare&version=<id>&mode=new|edit`; підвкладки `Щоденні оновлення` і `Порівняння` поки заглушки (фази 6–7).
- Rail версій (`components/versions/VersionRail.tsx`, sticky, 32%): `+ Нове оновлення`, версії `update_date desc, created_at desc`, дата, Title, кількість щоденних змін, маркер актуальної.
- Перегляд версії (`VersionView.tsx`): `Актуальна версія` / `Архівна версія` з `Повернутися до актуальної`, `Редагувати` для обох; розділи `01 / …` у порядку Part B; `Історія` — `ChangeRecord` для `daily_changes` цієї версії.
- `ChangeRecord` (`ChangeRecord.tsx`): скаляри з `−/+` і згортанням довгого тексту до 2 рядків, Skills як додані/прибрані теги, колекції — додано/видалено/змінено (по полях)/порядок (з назвами елементів). Буде перевикористаний у фазі 6.
- Форма (`VersionForm.tsx` + `CollectionEditor.tsx`): одна для створення й редагування; нова версія заповнюється з актуальної зі збереженням id елементів; дата за замовчуванням сьогодні; лічильник Description, Skills ≤ 20; колекції з додаванням, редагуванням, видаленням із підтвердженням і зміною порядку (drag, клавіатура через handle, кнопки ↑/↓); зображення Portfolio завантажуються в `portfolio-images`; помилки zod показуються біля конкретного поля елемента; незбережені зміни — підтвердження при скасуванні та `beforeunload`; архівна версія — рядок «Ви редагуєте архівну версію…».
- Перевірено в браузері (mock): перегляд актуальної й архівної версій та їхньої історії, створення оновлення (перестановка, новий елемент, помилка валідації), редагування архіву без нових щоденних змін, підтвердження скасування, завантаження зображення Portfolio.
