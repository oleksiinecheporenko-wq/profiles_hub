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
- [ ] 2. Міграції (enums, таблиці, view, тригери, функції, buckets), seed, інтерфейс `Repository` з обома реалізаціями.
- [ ] 3. `Профілі`: список і `Додати профіль`.
- [ ] 4. Сторінка профілю: шапка, зміна статусу, `Основна інформація` з inline-редагуванням і мовами.
- [ ] 5. `Оновлення → Глобальне оновлення`: rail версій, актуальна й архівна версії, форма створення/редагування, колекції з reorder.
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
