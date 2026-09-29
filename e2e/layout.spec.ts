import { expect, test } from "@playwright/test";

// Part B acceptance: no unexpected horizontal overflow at the target desktop widths.
const WIDTHS = [1280, 1366, 1440, 1920];
const ROUTES = [
  "/profiles",
  "/status-profiles",
  "/actions",
  "/contracts",
  "/profiles/00000000-0000-4000-8000-000000000073",
  "/profiles/00000000-0000-4000-8000-000000000001?tab=updates",
  "/profiles/00000000-0000-4000-8000-000000000001?tab=updates&sub=daily",
  "/profiles/00000000-0000-4000-8000-000000000001?tab=updates&sub=compare",
];

for (const width of WIDTHS) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ROUTES) {
      await page.goto(route);
      await expect(page.locator("main h1").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${route} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });
}

test("comparison rows keep both sides aligned at 1366px", async ({ page }) => {
  await page.goto("/profiles/00000000-0000-4000-8000-000000000001?tab=updates&sub=compare");
  const rows = page.locator("main section[aria-label]");
  const count = await rows.count();
  expect(count).toBeGreaterThan(5);
  for (let i = 0; i < count; i++) {
    // Each field is one grid row: both cells start at the same vertical position.
    const tops = await rows.nth(i).evaluate((row) => {
      const cells = row.querySelector(":scope > div:last-child")?.children;
      if (!cells || cells.length < 2) return null;
      return [cells[0].getBoundingClientRect().top, cells[1].getBoundingClientRect().top];
    });
    if (tops) expect(Math.abs(tops[0] - tops[1])).toBeLessThan(1);
  }
});
