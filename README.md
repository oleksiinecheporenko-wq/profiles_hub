# Estimation Hub

Внутрішній інструмент Coralsoft для швидких естімейтів: запит клієнта з джоб постом і матеріалами, таблиця оцінки по фазах, готовий звіт з рейтом, PDF для клієнта й архів із пошуком.

Next.js 16 (App Router, TypeScript) · Supabase (Postgres + Storage) · Tailwind CSS 4. Інтерфейс українською, PDF англійською, лише десктоп (від 1280 px).

## Як це працює

- **Запити**: «Новий запит» створює картку (клієнт, проєкт). У картці дві вкладки:
  - **Опис**: заголовок і текст джоб посту, додаткова інформація, матеріали (фото, відео, файли до 50 МБ, посилання);
  - **Оцінка**: розробник і таблиця Feature / Notes / Optimistic / Pessimistic / Realistic. Нова картка має 11 рядків, перший з них Phase. Години вводяться лише в Realistic; Optimistic = Realistic − 6 (не нижче 0), Pessimistic = Realistic + 6. Рядок фази показує суму своїх задач. Усе зберігається автоматично.
- **Готово** закриває редагування, прибирає порожні рядки, фіксує час готовності й переносить запит у **Готові запити**. Там з’являється зелений рядок Total: години по кожному сценарію, поле рейту і вартість (рейт × години). **Редагувати** повертає запит у «Запити»; час готовності скидається.
- **Зберегти** фіксує рейт і переносить оцінку в **Архів** (лише перегляд і PDF, пошук за клієнтом, проєктом, джоб постом і розробником).
- **PDF**: A4 англійською з підсумками трьох сценаріїв, таблицею по фазах, Total і вартістю.

Файли завантажуються з браузера напряму в приватний bucket `estimate-materials` за підписаним URL, тому обмеження Vercel на розмір запиту (4,5 МБ) їх не стосується.

## Локальний запуск на тестових даних

Потрібен Node.js 20+.

```bash
npm install
npm run dev
```

Якщо `SUPABASE_URL` не задано, застосунок працює на тестових даних у пам’яті (5 вигаданих запитів у всіх трьох розділах). У футері сайдбару видно мітку `mock data`. Зміни живуть до перезапуску сервера.

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
npm test            # Vitest: розрахунок годин і вартості, mock-репозиторій, PDF, міграції на PGlite
npm run test:e2e    # Playwright: запит → готово → архів, PDF, пошук (тестові дані)
```

Перед першим запуском e2e: `npx playwright install chromium`.

## Структура

```
src/app/(app)/requests|ready|archive   три розділи зі списками карток
src/app/(app)/estimates/[id]           картка запиту: Опис і Оцінка
src/app/(app)/estimates/actions.ts     server actions
src/app/api/estimates/[id]/pdf         PDF для клієнта
src/components/estimates/              екрани й компоненти естімейтів
src/lib/domain/estimate.ts             модель, рядки за замовчуванням, години й вартість
src/lib/data/                          Repository: supabase.ts, mock.ts, тестові дані
src/lib/export/                        PDF (@react-pdf/renderer, шрифт Roboto)
supabase/migrations/                   схема (остання міграція прибирає таблиці Profiles Hub)
```
