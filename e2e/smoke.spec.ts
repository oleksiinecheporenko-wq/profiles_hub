import { expect, test } from "@playwright/test";

// Part A, section 10: the main flow against the mock repository.
test("main flow: profile → daily change → global update → comparison → status → activity → contract → export", async ({
  page,
  request,
}) => {
  const name = `Смоук Тестовий ${Date.now()}`;

  // Create a profile.
  await page.goto("/profiles");
  await page.getByRole("button", { name: "Додати профіль" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ПІБ").fill(name);
  await dialog.getByLabel("Тайтл").fill("QA Engineer | Smoke");
  await dialog.getByRole("button", { name: "Створити" }).click();
  await expect(page).toHaveURL(/\/profiles\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const profileUrl = page.url();
  const profileId = profileUrl.split("/").pop()!;

  // Change Rate in `Основна інформація`.
  await page.getByRole("button", { name: "Редагувати: Rate" }).click();
  await page.keyboard.type("50");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Збережено в Актуальну версію.")).toBeVisible();

  // The change appears in `Щоденні оновлення`.
  await page.getByRole("link", { name: "Оновлення", exact: true }).click();
  await page.getByRole("link", { name: "Щоденні оновлення" }).click();
  const history = page.getByRole("complementary", { name: "Історія змін" });
  await expect(history.getByText("$50/год")).toBeVisible();

  // Create a global update with a new Rate.
  await page.getByRole("link", { name: "Глобальне оновлення" }).click();
  await page.getByRole("link", { name: "Нове оновлення" }).click();
  const rate = page.getByLabel("Rate", { exact: true });
  await rate.fill("60");
  await page.getByRole("button", { name: "Зберегти" }).click();
  await expect(page).toHaveURL(/version=/);
  await expect(page.getByRole("heading", { name: /Актуальна версія/ })).toBeVisible();

  // `Порівняння` marks Rate as changed.
  await page.getByRole("link", { name: "Порівняння" }).click();
  const rateRow = page.getByRole("region", { name: "Rate", exact: true });
  await expect(rateRow.getByText("Змінено")).toBeVisible();
  await expect(rateRow.getByText("$50/год")).toBeVisible();
  await expect(rateRow.getByText("$60/год")).toBeVisible();

  // Change the status with a reason.
  await page.getByRole("button", { name: "Статус: Active. Змінити" }).click();
  await page.getByRole("menuitem", { name: "Hold" }).click();
  const confirm = page.getByRole("dialog");
  await confirm.getByLabel("Причина").fill("Смоук-причина");
  await confirm.getByRole("button", { name: "Змінити статус" }).click();
  await expect(page.getByText("Статус змінено на Hold.")).toBeVisible();

  // The entry appears in `Дії`.
  await page.goto("/actions");
  await expect(page.getByText("Статус змінено з Active на Hold. Причина: Смоук-причина")).toBeVisible();

  // Create a contract for the profile and close it.
  await page.goto(`/contracts/new?profile=${profileId}`);
  await page.getByLabel("Тайтл").fill("Смоук-контракт");
  await page.getByRole("button", { name: "Зберегти" }).click();
  await expect(page).toHaveURL(/\/contracts\/[0-9a-f-]{36}$/);
  const contractId = page.url().split("/").pop()!;
  await page.getByRole("button", { name: "Закрити контракт" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Закрити контракт" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Закритий")).toBeVisible();

  // The Word export returns a file.
  const response = await request.get(`/api/contracts/${contractId}/export?format=docx`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("wordprocessingml");
  expect(response.headers()["content-disposition"]).toContain("contract-smouk-kontrakt-");
  const body = await response.body();
  expect(body.subarray(0, 2).toString()).toBe("PK");
});
