import { describe, expect, it } from "vitest";
import { buildSampleDataset } from "@/lib/data/sample";
import { estimateFileName, pdfModel, slugify } from "./common";
import { buildEstimatePdf } from "./pdf";

describe("estimate pdf", () => {
  it("builds the model, skipping blank rows, with cost per scenario", async () => {
    const shop = (await buildSampleDataset()).estimates.find((e) => e.clientName === "Умовна Крамниця")!;
    const blank = { id: crypto.randomUUID(), kind: "task" as const, feature: "", notes: "", realistic: null };
    const m = pdfModel({ ...shop, rows: [...shop.rows, blank] });
    expect(m.lines).toHaveLength(shop.rows.length);
    expect(m.total.realistic).toBe(114);
    expect(m.cost?.realistic).toBe(114 * 35);
    expect(m.date).toBe("1 October 2026");
    expect(m.nextSteps.map((st) => st.title)).toEqual(["Discovery call", "Proposal", "Kick-off"]);
    const own = pdfModel({ ...shop, nextSteps: [{ id: "a", title: "Workshop", text: "Two hours" }] });
    expect(own.nextSteps).toEqual([{ id: "a", title: "Workshop", text: "Two hours" }]);
  });

  it("names the file after client, project and date", () => {
    expect(slugify("Умовна Крамниця")).toBe("umovna-kramnytsia");
    expect(
      estimateFileName({ clientName: "Приклад Лабс", projectName: "Лендинг", createdAt: "2026-10-06T12:00:00.000Z", readyAt: null }),
    ).toBe("estimate-pryklad-labs-lendynh-2026-10-06.pdf");
  });

  it("renders a PDF", async () => {
    const shop = (await buildSampleDataset()).estimates.find((e) => e.status === "archived")!;
    const pdf = await buildEstimatePdf(shop);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000);
});
