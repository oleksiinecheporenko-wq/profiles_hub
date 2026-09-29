# Upwork Profile Manager

Внутрішній вебзастосунок для команди, що веде профілі Upwork: дані акаунтів, глобальні та щоденні оновлення вмісту, порівняння версій, статуси, повний журнал дій і контракти з експортом у Word і PDF.

Next.js 16 (App Router, TypeScript) · Supabase (Postgres + Storage) · Tailwind CSS 4. Інтерфейс українською, лише десктоп (від 1280 px).

## Локальний запуск на тестових даних

Потрібен Node.js 20+.

```bash
npm install
npm run dev
```

Якщо `SUPABASE_URL` не задано, застосунок працює на тестових даних у пам’яті (6 вигаданих профілів, версії, щоденні зміни, 5 контрактів). У футері сайдбару видно мітку `mock data`. Зміни живуть до перезапуску сервера.

## Підключення Supabase

1. Створіть проєкт на [supabase.com](https://supabase.com).
2. Прив’яжіть його та застосуйте міграції:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

3. За бажання — тестові дані: `npx supabase db push --include-seed` (або `npx supabase db seed` для локальної бази). Файл `supabase/seed.sql` генерується з `src/lib/data/sample.ts` командою `npm run db:seed:generate`.
4. Створіть `.env.local` за зразком `.env.example`:

   ```
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service_role / secret key>
   ```

Браузер ніколи не звертається до Supabase напряму: усі читання й записи йдуть через серверний код із service role key. RLS увімкнено на всіх таблицях без політик для `anon` і `authenticated`.

## Змінні середовища

| Змінна | Опис |
| --- | --- |
| `SUPABASE_URL` | URL проєкту Supabase. Порожня — тестові дані в пам’яті. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (secret) key. Лише на сервері. |
| `APP_ACCESS_PASSWORD` | Необов’язковий спільний пароль. Порожній — вхід без пароля. |
| `APP_COOKIE_SECRET` | Обов’язковий, якщо задано пароль: підпис cookie доступу (30 днів). |

## Деплой на Vercel

1. Імпортуйте репозиторій у Vercel (Framework: Next.js).
2. У Settings → Environment Variables додайте `SUPABASE_URL` і `SUPABASE_SERVICE_ROLE_KEY`.
3. Deploy.
4. Щоб увімкнути парольний вхід, додайте `APP_ACCESS_PASSWORD` і довгий випадковий `APP_COOKIE_SECRET` (наприклад, `openssl rand -base64 32`) і перезапустіть деплой. Без пароля застосунок доступний кожному, хто знає URL (сторінки закриті від індексації).

## Перевірки

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # Vitest: доменна логіка, валідація, експорт, міграції на PGlite
npm run test:e2e    # Playwright: основний сценарій і верстка на 1280–1920 px (тестові дані)
```

Перед першим запуском e2e: `npx playwright install chromium`.

## Структура

```
src/app/(app)/…            сторінки: profiles, status-profiles, actions, contracts
src/app/api/contracts/…    експорт контракту (docx / pdf)
src/components/            спільні компоненти й екрани
src/lib/data/              Repository: supabase.ts, mock.ts, тестові дані, стрічка дій
src/lib/domain/            правила версій, щоденних змін, порівняння, журналу
src/lib/validation/        zod-схеми для форм і server actions
supabase/migrations/       схема, тригери журналу, функції, buckets
docs/PLAN.md               план і нотатки по фазах
```
