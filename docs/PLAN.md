# Estimation Hub — нотатки

Profiles Hub (профілі Upwork, версії, контракти) замінено на Estimation Hub у тому ж репозиторії, проєкті Vercel і базі Supabase. Історію попереднього плану збережено в `docs/PLAN-profiles-hub.md`.

## Рішення

- Одна таблиця `estimates`: рядки оцінки лежать у `rows jsonb` (порядок = порядок у таблиці), посилання в `links jsonb`. Файли — окрема таблиця `estimate_files` з каскадним видаленням.
- Статуси: `in_progress` (Запити) → `ready` (Готові запити) → `archived` (Архів). Перевірки в БД: `ready_at` заданий тоді й лише тоді, коли статус не `in_progress`; архів завжди має рейт.
- Переходи статусів — умовні `update … where status in (…)`, тож подвійне натискання чи застаріла вкладка не зламають стан.
- Optimistic/Pessimistic не зберігаються: вони обчислюються з Realistic (`src/lib/domain/estimate.ts`), як і підсумки фаз, Total і вартість.
- Таблицю можна редагувати лише в статусі `in_progress`. Текстові поля «Опис» — також у `ready`. Архів лише для перегляду.
- Матеріали: підписаний URL на завантаження (браузер → Storage), перегляд через підписані URL на 1 годину. Без Supabase (тестові дані) файли до 4 МБ ідуть через server action.

## Розгортання зміни

1. Застосувати `supabase/migrations/20261020100000_estimation_hub.sql` (SQL Editor або `npx supabase db push`). Міграція **видаляє** таблиці Profiles Hub.
2. Лише після цього пушити в `main`: push запускає деплой на Vercel.
