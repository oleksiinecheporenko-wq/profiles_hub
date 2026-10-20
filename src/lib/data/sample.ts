// Sample data shared by the mock repository and supabase/seed.sql. Produced by running
// real operations against a MockRepository with a scripted clock and deterministic ids.
// Fictional clients, example.com links, no real people or brands.

import type { EstimateRow, Timestamp, Uuid } from "@/lib/domain/estimate";
import { emptyMockState, MockRepository, type MockState } from "./mock";

export function sampleUuid(n: number): Uuid {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

type Ctx = { repo: MockRepository; at: (iso: string) => void; id: () => Uuid };

function rows(ctx: Ctx, spec: [kind: "phase" | "task", feature: string, notes: string, realistic: number | null][]): EstimateRow[] {
  return spec.map(([kind, feature, notes, realistic]) => ({ id: ctx.id(), kind, feature, notes, realistic }));
}

async function script(ctx: Ctx) {
  const { repo, at } = ctx;

  // 1. Archived: online store.
  at("2026-10-01T07:00:00.000Z");
  const shop = await repo.createEstimate({ clientName: "Умовна Крамниця", projectName: "Інтернет-магазин домашнього текстилю" });
  at("2026-10-01T07:20:00.000Z");
  await repo.updateInfo(shop.id, {
    jobTitle: "Need a developer for an online store (catalog, cart, payments)",
    jobDescription:
      "We sell home textiles and need an online store.\n\n- Catalog with filters\n- Cart and checkout\n- Online payments\n- Admin panel for orders",
    additionalInfo: "Клієнт хоче запуск до кінця року. Дизайн у Figma вже є.",
    links: [{ id: ctx.id(), url: "https://example.com/design/textile-store", label: "Макети" }],
    developer: "Остап Вигаданий",
  });
  at("2026-10-01T09:10:00.000Z");
  await repo.updateRows(
    shop.id,
    rows(ctx, [
      ["phase", "Discovery & Setup", "", null],
      ["task", "Project setup, CI/CD", "Repository, environments, deploy pipeline", 6],
      ["task", "Data model & admin", "Products, categories, orders", 16],
      ["phase", "Storefront", "", null],
      ["task", "Catalog with filters", "Size, color, price, availability", 24],
      ["task", "Product page", "Gallery, variants, related products", 14],
      ["task", "Cart & checkout", "Guest checkout, delivery options", 20],
      ["task", "Payments integration", "One payment provider, webhooks", 12],
      ["phase", "QA & Launch", "", null],
      ["task", "Testing & fixes", "", 16],
      ["task", "Launch support", "", 6],
    ]),
  );
  at("2026-10-01T10:30:00.000Z");
  await repo.markReady(shop.id);
  at("2026-10-02T08:00:00.000Z");
  await repo.setRate(shop.id, 35);
  at("2026-10-02T08:05:00.000Z");
  await repo.archive(shop.id);

  // 2. Archived: landing page.
  at("2026-10-06T12:00:00.000Z");
  const landing = await repo.createEstimate({ clientName: "Приклад Лабс", projectName: "Лендинг для мобільного застосунку" });
  at("2026-10-06T12:10:00.000Z");
  await repo.updateInfo(landing.id, {
    jobTitle: "Landing page for a fitness app",
    jobDescription: "One-page site with app features, pricing and download buttons. Animations welcome.",
    developer: "Марта Прикладна",
  });
  at("2026-10-06T13:00:00.000Z");
  await repo.updateRows(
    landing.id,
    rows(ctx, [
      ["phase", "Landing page", "", null],
      ["task", "Layout & responsive", "5 sections", 14],
      ["task", "Animations", "Scroll-triggered", 6],
      ["task", "Forms & analytics", "", 4],
    ]),
  );
  at("2026-10-06T14:00:00.000Z");
  await repo.markReady(landing.id);
  at("2026-10-07T09:00:00.000Z");
  await repo.setRate(landing.id, 30);
  await repo.archive(landing.id);

  // 3. Ready: CRM integration, waiting for the rate.
  at("2026-10-15T08:30:00.000Z");
  const crm = await repo.createEstimate({ clientName: "Тестова Логістика", projectName: "Інтеграція CRM з обліковою системою" });
  at("2026-10-15T08:40:00.000Z");
  await repo.updateInfo(crm.id, {
    jobTitle: "Sync orders between our CRM and accounting",
    jobDescription: "Two-way sync of clients and invoices every 15 minutes, with error reporting.",
    developer: "Богдан Тестенко",
  });
  at("2026-10-15T11:00:00.000Z");
  await repo.updateRows(
    crm.id,
    rows(ctx, [
      ["phase", "Integration", "", null],
      ["task", "API research", "Both systems, auth, limits", 8],
      ["task", "Sync service", "Queue, retries", 24],
      ["task", "Error reporting", "Email + dashboard", 8],
      ["phase", "Delivery", "", null],
      ["task", "Testing on staging", "", 10],
    ]),
  );
  at("2026-10-15T12:15:00.000Z");
  await repo.markReady(crm.id);

  // 4–5. In progress.
  at("2026-10-19T09:00:00.000Z");
  const bot = await repo.createEstimate({ clientName: "Умовна Агенція", projectName: "Telegram-бот для запису клієнтів" });
  at("2026-10-19T09:15:00.000Z");
  await repo.updateInfo(bot.id, {
    jobTitle: "Booking bot for a beauty salon",
    jobDescription: "Clients choose a master, service and time; admin sees bookings in a web panel.",
  });
  at("2026-10-20T07:30:00.000Z");
  await repo.createEstimate({ clientName: "Вигадана Студія", projectName: "Редизайн корпоративного сайту" });
}

export type SampleDataset = MockState;

export async function buildSampleDataset(): Promise<SampleDataset> {
  let clock: Timestamp = "2026-10-01T00:00:00.000Z";
  let idCounter = 0;
  const repo = new MockRepository(emptyMockState(), {
    now: () => clock,
    newId: () => sampleUuid(++idCounter),
  });
  await script({ repo, at: (iso) => (clock = iso), id: () => sampleUuid(++idCounter) });
  return repo.state;
}
