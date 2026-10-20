import { expect, test } from "@playwright/test";

test("sections list the sample estimates", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/requests$/);
  await expect(page.getByRole("heading", { name: "Умовна Агенція" })).toBeVisible();
  await page.getByRole("link", { name: "Готові запити" }).click();
  await expect(page.getByRole("heading", { name: "Тестова Логістика" })).toBeVisible();
  await page.getByRole("link", { name: "Архів" }).click();
  await page.getByRole("searchbox", { name: "Пошук в архіві" }).fill("крамниця");
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByRole("heading", { name: "Умовна Крамниця" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Приклад Лабс" })).toHaveCount(0);
});

test("request → ready → archive, with the PDF", async ({ page }) => {
  await page.goto("/requests");
  await page.getByRole("button", { name: "Новий запит" }).click();
  await page.getByLabel("Клієнт").fill("E2E Клієнт");
  await page.getByLabel("Проєкт").fill("E2E Проєкт");
  await page.getByRole("button", { name: "Створити" }).click();
  await expect(page).toHaveURL(/\/estimates\/[0-9a-f-]{36}/);

  // Опис
  await page.getByLabel("Заголовок джоб посту").fill("Need a booking app");
  await page.getByLabel("Опис джоб посту").click();
  await expect(page.getByText("Збережено")).toBeVisible();

  // Оцінка: 11 default rows, the first one a phase.
  await page.getByRole("tab", { name: "Оцінка" }).click();
  await expect(page).toHaveURL(/tab=estimate/);
  const table = page.getByRole("table");
  await expect(table.locator("tbody tr")).toHaveCount(11);
  await page.getByLabel("Розробник").fill("Тест Розробник");
  await page.getByLabel("Назва фази").fill("MVP");
  await page.getByLabel("Feature").first().fill("Login");
  await page.getByLabel("Realistic, год: Login").fill("10");
  const login = table.locator("tbody tr").nth(1);
  await expect(login.locator("td").nth(2)).toHaveText("4");
  await expect(login.locator("td").nth(3)).toHaveText("16");

  await page.getByRole("button", { name: "Add a Row" }).click();
  await expect(table.locator("tbody tr")).toHaveCount(12);
  await page.getByRole("button", { name: "Готово" }).click();

  // Ready: read-only, blank rows dropped, green Total with the rate.
  await expect(page.getByRole("button", { name: "Редагувати" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a Row" })).toHaveCount(0);
  await expect(table.locator("tbody tr")).toHaveCount(2);
  const total = table.locator("tfoot tr");
  await expect(total).toContainText("Total");
  await page.getByLabel("Рейт, $ за годину").fill("40");
  await expect(total).toContainText("$400");
  await expect(total).toContainText("$160");
  await expect(total).toContainText("$640");

  // Next steps: standard ones until edited; edits are saved and survive a reload.
  await expect(page.getByText("Стандартні кроки: додаються в PDF автоматично.")).toBeVisible();
  await page.getByLabel("Крок 1: назва").fill("Technical workshop");
  await expect(page.getByText("Власні кроки для PDF клієнта.")).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Оцінка" }).getByText("Збережено")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Крок 1: назва")).toHaveValue("Technical workshop");
  await page.getByRole("button", { name: "Стандартні кроки" }).click();
  await expect(page.getByLabel("Крок 1: назва")).toHaveValue("Discovery call");
  await page.getByLabel("Крок 2: назва").fill("Prototype");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^estimate-e2e-kliient-e2e-proiekt-\d{4}-\d{2}-\d{2}\.pdf$/);

  await page.goto("/ready");
  await expect(page.getByRole("heading", { name: "E2E Клієнт" })).toBeVisible();
  await page.getByRole("heading", { name: "E2E Клієнт" }).click();

  await page.getByRole("button", { name: "Зберегти" }).click();
  await expect(page.getByText("В архіві")).toBeVisible();
  await expect(table.locator("tfoot")).toContainText("$40/год");

  await page.goto("/archive?q=E2E");
  await expect(page.getByRole("heading", { name: "E2E Клієнт" })).toBeVisible();
});
