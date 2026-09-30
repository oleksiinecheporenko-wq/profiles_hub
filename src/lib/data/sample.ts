// Sample data set shared by the mock repository and supabase/seed.sql (Part A, section 8).
// It is produced by running real operations against a MockRepository with a scripted
// clock and deterministic ids, so versions, daily changes and log rows are consistent.
// Clearly fictional names, example.com addresses, no real people and no brand names.

import type { DailyChangeInput } from "@/lib/domain/dailyChanges";
import type { ProfileStatus } from "@/lib/domain/enums";
import type {
  Certification,
  EmploymentItem,
  OtherExperience,
  PortfolioItem,
  ProjectCatalogItem,
  Timestamp,
  Uuid,
  VersionContent,
} from "@/lib/domain/types";
import { emptyMockState, MockRepository, type MockState } from "./mock";

/** Deterministic, valid v4-shaped UUIDs: 00000000-0000-4000-8000-000000000001, … */
export function sampleUuid(n: number): Uuid {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

type Ctx = {
  repo: MockRepository;
  at: (iso: string) => void;
  id: () => Uuid;
};

function portfolio(ctx: Ctx, title: string, description: string, slug: string): PortfolioItem {
  return { id: ctx.id(), title, description, url: `https://portfolio.example.com/${slug}`, image_path: null };
}

function project(ctx: Ctx, title: string, description: string, price: number): ProjectCatalogItem {
  return { id: ctx.id(), title, description, price, url: null };
}

function cert(ctx: Ctx, title: string, issuer: string, from: string, to: string | null, description: string | null): Certification {
  return { id: ctx.id(), title, issuer, date_from: from, date_to: to, description };
}

function job(
  ctx: Ctx,
  company: string,
  position: string,
  from: string,
  to: string | null,
  description: string,
): EmploymentItem {
  return { id: ctx.id(), company, position, date_from: from, date_to: to, description };
}

function other(ctx: Ctx, title: string, description: string): OtherExperience {
  return { id: ctx.id(), title, description };
}

async function current(ctx: Ctx, profileId: Uuid) {
  const v = await ctx.repo.getCurrentVersion(profileId);
  if (!v) throw new Error("sample: no current version");
  return v;
}

async function daily(ctx: Ctx, profileId: Uuid, change: DailyChangeInput) {
  const v = await current(ctx, profileId);
  return ctx.repo.applyDailyChange(v.id, change, v.updatedAt);
}

async function globalUpdate(
  ctx: Ctx,
  profileId: Uuid,
  updateDate: string,
  edit: (content: VersionContent) => VersionContent,
) {
  const v = await current(ctx, profileId);
  return ctx.repo.createGlobalVersion(profileId, { updateDate, content: edit(structuredClone(v.content)) });
}

async function createProfile(
  ctx: Ctx,
  fullName: string,
  title: string,
  slug: string,
  status: ProfileStatus = "active",
) {
  return ctx.repo.createProfile({
    fullName,
    status,
    title,
    profileUrl: `https://www.upwork.com/freelancers/~01${slug}`,
    photoPath: null,
  });
}

async function script(ctx: Ctx) {
  const { repo, at } = ctx;

  // ---- 1. Остап Вигаданий — frontend, Active, 3 versions ------------------
  at("2026-05-04T07:10:00.000Z");
  const ostap = await createProfile(ctx, "Остап Вигаданий", "Frontend Developer | Web Apps", "a1f0000000000001");
  at("2026-05-04T07:25:00.000Z");
  await repo.updateProfileFields(ostap.id, {
    visibility: "public",
    experienceLevel: "expert",
    education: "Магістр комп’ютерних наук, умовний технічний університет",
    categories: ["Web Development", "Frontend Development"],
    email: "ostap.vyhadanyi@example.com",
    billingMethod: "card",
    timeZone: "Europe/Kyiv",
    address: "вул. Умовна, 1, Київ",
    phone: "+380 00 000 00 01",
  });
  at("2026-05-04T07:30:00.000Z");
  await repo.setProfileLanguages(ostap.id, [
    { language: "Ukrainian", level: "native" },
    { language: "English", level: "fluent" },
  ]);
  at("2026-05-04T08:00:00.000Z");
  await globalUpdate(ctx, ostap.id, "2026-05-04", (c) => ({
    ...c,
    rate: 35,
    description:
      "Будую швидкі та доступні вебзастосунки: від прототипу до стабільного релізу.\n\nПрацюю з компонентними інтерфейсами, дизайн-системами та інтеграцією API. Пишу тести і документацію.",
    skills: ["JavaScript", "HTML", "CSS", "Frontend Development", "REST API", "Accessibility"],
    portfolio: [
      portfolio(ctx, "Панель аналітики для складу", "Інтерактивні таблиці та фільтри для внутрішньої команди.", "warehouse-dashboard"),
      portfolio(ctx, "Лендинг для навчальної платформи", "Адаптивна верстка, анімації, форма заявки.", "edu-landing"),
    ],
    project_catalog: [
      project(ctx, "Аудит продуктивності сайту", "Звіт із рекомендаціями та швидкими виправленнями.", 250),
    ],
    employment_history: [
      job(ctx, "Умовна Студія", "Frontend Developer", "2021-03-01", null, "Розробка клієнтських вебзастосунків."),
      job(ctx, "Приклад Лабс", "Junior Developer", "2019-06-01", "2021-02-28", "Підтримка внутрішніх сервісів."),
    ],
    certifications: [cert(ctx, "Web Accessibility Fundamentals", "Умовна Академія", "2022-11-15", "2025-11-15", "Курс з доступності вебінтерфейсів (WCAG 2.1).")],
  }));
  at("2026-05-18T09:12:00.000Z");
  await daily(ctx, ostap.id, { field: "rate", value: 38 });
  at("2026-05-26T13:40:00.000Z");
  await daily(ctx, ostap.id, {
    field: "portfolio",
    op: "add",
    item: portfolio(ctx, "Кабінет клієнта сервісної компанії", "Особистий кабінет з історією замовлень.", "client-portal"),
  });
  at("2026-06-15T08:30:00.000Z");
  await globalUpdate(ctx, ostap.id, "2026-06-15", (c) => ({
    ...c,
    title: "Senior Frontend Developer | Web Apps & Design Systems",
    skills: [...c.skills, "Design Systems", "Testing"],
    other_experiences: [other(ctx, "Менторство", "Проводжу code review і навчаю молодших розробників.")],
  }));
  at("2026-07-02T10:05:00.000Z");
  await daily(ctx, ostap.id, { field: "rate", value: 40 });
  at("2026-07-09T14:20:00.000Z");
  {
    const v = await current(ctx, ostap.id);
    const item = v.content.portfolio[0];
    await daily(ctx, ostap.id, {
      field: "portfolio",
      op: "update",
      item: { ...item, description: "Інтерактивні таблиці, фільтри та експорт звітів для команди складу." },
    });
  }
  at("2026-07-09T14:22:00.000Z");
  {
    const v = await current(ctx, ostap.id);
    await daily(ctx, ostap.id, {
      field: "portfolio",
      op: "reorder",
      ids: [v.content.portfolio[2].id, v.content.portfolio[0].id, v.content.portfolio[1].id],
    });
  }

  // ---- 2. Марта Прикладна — UI/UX, Active, 3 versions ---------------------
  at("2026-05-06T11:00:00.000Z");
  const marta = await createProfile(ctx, "Марта Прикладна", "UI/UX Designer | Product Interfaces", "a1f0000000000002");
  at("2026-05-06T11:20:00.000Z");
  await repo.updateProfileFields(marta.id, {
    visibility: "upwork_only",
    experienceLevel: "intermediate",
    education: "Бакалавр дизайну",
    categories: ["UI/UX Design", "Product Design"],
    email: "marta.prykladna@example.com",
    billingMethod: "paypal",
    timeZone: "Europe/Warsaw",
  });
  at("2026-05-06T11:25:00.000Z");
  await repo.setProfileLanguages(marta.id, [
    { language: "Ukrainian", level: "native" },
    { language: "English", level: "conversational" },
    { language: "Polish", level: "basic" },
  ]);
  at("2026-05-06T12:00:00.000Z");
  await globalUpdate(ctx, marta.id, "2026-05-06", (c) => ({
    ...c,
    rate: 30,
    description: "Проєктую інтерфейси, які легко зрозуміти з першого екрана. Дослідження, прототипи, UI-кіти.",
    skills: ["UI Design", "UX Research", "Prototyping", "Wireframing", "Design Systems"],
    portfolio: [portfolio(ctx, "Мобільний застосунок для запису до лікаря", "Від інтерв’ю з користувачами до UI-кіту.", "clinic-app")],
    project_catalog: [
      project(ctx, "UX-аудит одного сценарію", "Розбір сценарію та список покращень.", 180),
      project(ctx, "Дизайн лендингу", "Макет десктоп і мобільної версії.", 400),
    ],
  }));
  at("2026-05-20T08:45:00.000Z");
  await daily(ctx, marta.id, {
    field: "skills",
    value: ["UI Design", "UX Research", "Prototyping", "Design Systems", "Usability Testing"],
  });
  at("2026-06-03T09:00:00.000Z");
  await globalUpdate(ctx, marta.id, "2026-06-03", (c) => ({
    ...c,
    title: "Product Designer | UX Research & Interfaces",
    rate: 34,
  }));
  at("2026-06-21T15:30:00.000Z");
  {
    const v = await current(ctx, marta.id);
    await daily(ctx, marta.id, { field: "project_catalog", op: "remove", itemId: v.content.project_catalog[1].id });
  }
  at("2026-08-12T10:00:00.000Z");
  await globalUpdate(ctx, marta.id, "2026-08-12", (c) => ({
    ...c,
    description:
      "Проєктую інтерфейси, які легко зрозуміти з першого екрана.\n\nДослідження, прототипи, UI-кіти, передача макетів у розробку з детальними специфікаціями.",
    certifications: [cert(ctx, "UX Research Practitioner", "Умовна Школа Дизайну", "2026-07-01", null, null)],
  }));
  at("2026-08-20T07:50:00.000Z");
  await daily(ctx, marta.id, { field: "rate", value: 36 });

  // ---- 3. Тарас Умовний — data analyst, Hold, 2 versions ------------------
  at("2026-05-10T06:30:00.000Z");
  const taras = await createProfile(ctx, "Тарас Умовний", "Data Analyst | Reports & Dashboards", "a1f0000000000003");
  at("2026-05-10T06:40:00.000Z");
  await repo.setProfileLanguages(taras.id, [
    { language: "Ukrainian", level: "native" },
    { language: "English", level: "fluent" },
  ]);
  at("2026-05-10T07:00:00.000Z");
  await globalUpdate(ctx, taras.id, "2026-05-10", (c) => ({
    ...c,
    rate: 28,
    description: "Перетворюю сирі дані на зрозумілі звіти. Очищення даних, SQL-запити, дашборди.",
    skills: ["SQL", "Data Analysis", "Data Visualization", "Spreadsheets", "Python"],
    other_experiences: [other(ctx, "Волонтерський аналіз", "Аналіз даних для громадської організації.")],
  }));
  at("2026-06-01T12:10:00.000Z");
  await daily(ctx, taras.id, { field: "title", value: "Data Analyst | SQL, Reports & Dashboards" });
  at("2026-07-14T09:30:00.000Z");
  await globalUpdate(ctx, taras.id, "2026-07-14", (c) => ({ ...c, rate: 32 }));
  at("2026-09-02T08:00:00.000Z");
  await repo.changeProfileStatus(taras.id, "hold", "Тимчасова пауза: оновлюємо портфоліо.");

  // ---- 4. Ірина Зразкова — copywriter, Ban, 2 versions --------------------
  at("2026-05-12T10:00:00.000Z");
  const iryna = await createProfile(ctx, "Ірина Зразкова", "Copywriter | Website & Product Copy", "a1f0000000000004");
  at("2026-05-12T10:30:00.000Z");
  await globalUpdate(ctx, iryna.id, "2026-05-12", (c) => ({
    ...c,
    rate: 25,
    description: "Пишу тексти для сайтів, розсилок і продуктових сторінок. Ясно, коротко, по суті.",
    skills: ["Copywriting", "Content Writing", "SEO Writing", "Editing"],
  }));
  at("2026-06-10T11:00:00.000Z");
  await globalUpdate(ctx, iryna.id, "2026-06-10", (c) => ({
    ...c,
    title: "Senior Copywriter | Website, Email & Product Copy",
    skills: [...c.skills, "Email Marketing"],
  }));
  at("2026-06-25T09:15:00.000Z");
  await daily(ctx, iryna.id, {
    field: "description",
    value: "Пишу тексти для сайтів, розсилок і продуктових сторінок. Ясно, коротко, по суті. Працюю українською та англійською.",
  });
  at("2026-08-28T16:00:00.000Z");
  await repo.changeProfileStatus(iryna.id, "ban", "Акаунт заблоковано платформою, чекаємо відповіді підтримки.");

  // ---- 5. Богдан Тестенко — backend, Back to Developer, 3 versions --------
  at("2026-05-15T08:00:00.000Z");
  const bohdan = await createProfile(ctx, "Богдан Тестенко", "Backend Developer | APIs & Integrations", "a1f0000000000005");
  at("2026-05-15T08:20:00.000Z");
  await repo.updateProfileFields(bohdan.id, {
    experienceLevel: "expert",
    categories: ["Backend Development", "API Development"],
    timeZone: "Europe/Berlin",
  });
  at("2026-05-15T09:00:00.000Z");
  await globalUpdate(ctx, bohdan.id, "2026-05-15", (c) => ({
    ...c,
    rate: 45,
    description: "Проєктую та підтримую серверну частину: API, черги, інтеграції з платіжними й обліковими системами.",
    skills: ["API Development", "Databases", "Backend Development", "Integrations", "Testing"],
    employment_history: [job(ctx, "Умовний Інтегратор", "Backend Engineer", "2020-01-01", null, "Інтеграції та API.")],
  }));
  at("2026-06-18T10:00:00.000Z");
  await globalUpdate(ctx, bohdan.id, "2026-06-18", (c) => ({
    ...c,
    project_catalog: [project(ctx, "Інтеграція з API", "Підключення зовнішнього API до вашого сервісу.", 600)],
  }));
  at("2026-07-22T12:00:00.000Z");
  await globalUpdate(ctx, bohdan.id, "2026-07-22", (c) => ({ ...c, rate: 50 }));
  at("2026-07-30T08:40:00.000Z");
  {
    const v = await current(ctx, bohdan.id);
    await daily(ctx, bohdan.id, {
      field: "employment_history",
      op: "add",
      item: job(ctx, "Приклад Софт", "Team Lead", "2026-06-01", null, "Керую командою з чотирьох розробників."),
      index: 0,
    });
    void v;
  }
  at("2026-09-10T13:00:00.000Z");
  await repo.changeProfileStatus(bohdan.id, "back_to_developer", "Повернуто розробнику профілю на доопрацювання.");

  // ---- 6. Соломія Демченко-Приклад — mobile, Active, 2 versions ------------
  at("2026-06-01T09:00:00.000Z");
  const solomiia = await createProfile(
    ctx,
    "Соломія-Олександра Демченко-Прикладна",
    "Mobile Developer | Cross-platform Apps for Booking, Delivery and Fintech Startups",
    "a1f0000000000006",
  );
  at("2026-06-01T09:30:00.000Z");
  await globalUpdate(ctx, solomiia.id, "2026-06-01", (c) => ({
    ...c,
    rate: 42,
    description: "Розробляю кросплатформні мобільні застосунки: бронювання, доставка, фінансові сервіси.",
    skills: ["Mobile Development", "Cross-platform", "UI Implementation", "Push Notifications"],
  }));
  at("2026-09-22T10:10:00.000Z");
  await daily(ctx, solomiia.id, { field: "rate", value: 45 });

  // ---- Contracts --------------------------------------------------------------
  at("2026-06-05T09:00:00.000Z");
  const c1 = await repo.createContract({
    profileId: ostap.id,
    createdDate: "2026-06-05",
    title: "Редизайн панелі керування замовленнями",
    rate: 40,
    description: "Оновлення інтерфейсу внутрішньої панелі: таблиці, фільтри, експорт.",
    dialog:
      "Клієнт: Добрий день! Потрібно оновити нашу панель замовлень.\n\nФрилансер: Добрий день! Надішліть, будь ласка, доступ до тестового середовища.\n\nКлієнт: Надіслав. Дедлайн — кінець місяця.",
  });
  at("2026-06-06T10:30:00.000Z");
  await repo.addContractComment(c1.id, "Клієнт погодив перший етап.");
  at("2026-06-20T08:15:00.000Z");
  await repo.addContractComment(c1.id, "Другий етап у роботі, демо в п’ятницю.");

  at("2026-06-12T12:00:00.000Z");
  const c2 = await repo.createContract({
    profileId: marta.id,
    createdDate: "2026-06-12",
    title: "UX-аудит сценарію оформлення замовлення",
    rate: 34,
    description: "Аудит і прототип покращеного сценарію.",
    dialog: "Клієнт: Користувачі кидають кошик на кроці оплати.\nФрилансер: Почну з аналізу сесій і коротких інтерв’ю.",
  });
  at("2026-07-10T09:00:00.000Z");
  await repo.addContractComment(c2.id, "Звіт передано, клієнт задоволений.");
  at("2026-07-12T09:00:00.000Z");
  await repo.setContractStatus(c2.id, "closed");

  at("2026-07-01T07:30:00.000Z");
  await repo.createContract({
    profileId: bohdan.id,
    createdDate: "2026-07-01",
    title: "Інтеграція платіжного API",
    rate: 50,
    description: "Підключення платежів і вебхуків.",
    dialog: null,
  });

  at("2026-07-20T11:45:00.000Z");
  const c4 = await repo.createContract({
    profileId: iryna.id,
    createdDate: "2026-07-20",
    title: "Тексти для сторінок продукту",
    rate: 25,
    description: "Шість сторінок, дві ітерації правок.",
    dialog: "Клієнт: Потрібен тон — дружній, але без жаргону.",
  });
  at("2026-08-15T10:00:00.000Z");
  await repo.setContractStatus(c4.id, "closed");

  at("2026-09-15T08:00:00.000Z");
  const c5 = await repo.createContract({
    profileId: solomiia.id,
    createdDate: "2026-09-15",
    title: "Застосунок для бронювання столиків — MVP",
    rate: 45,
    description: null,
    dialog: null,
  });
  at("2026-09-16T09:20:00.000Z");
  await repo.addContractComment(c5.id, "Узгодили обсяг MVP: каталог, бронювання, сповіщення.");
}

export type SampleDataset = MockState;

/** Builds the sample data set. Deterministic: same output on every run. */
export async function buildSampleDataset(): Promise<SampleDataset> {
  let clock: Timestamp = "2026-05-01T00:00:00.000Z";
  let idCounter = 0;
  let txCounter = 0;
  const repo = new MockRepository(emptyMockState(), {
    now: () => clock,
    newId: () => sampleUuid(++idCounter),
    // Negative ids never collide with real Postgres transaction ids.
    nextTxId: () => --txCounter,
  });
  const ctx: Ctx = { repo, at: (iso) => (clock = iso), id: () => sampleUuid(++idCounter) };
  await script(ctx);
  return repo.state;
}
