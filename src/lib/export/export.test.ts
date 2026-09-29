import { describe, expect, it } from "vitest";
import type { ContractDetail } from "@/lib/domain/types";
import { contractFileName, slugify } from "./common";
import { buildContractDocx } from "./docx";
import { buildContractPdf } from "./pdf";

const contract: ContractDetail = {
  id: "00000000-0000-4000-8000-000000000001",
  profileId: "00000000-0000-4000-8000-000000000002",
  createdDate: "2026-09-29",
  title: "Редизайн панелі «Ґанок» — етап №1",
  rate: 40,
  description: "Опис українською.\nДругий рядок з Ї та Є.",
  dialog: "Клієнт: Добрий день!\n\n   Фрилансер: Вітаю, почнімо.",
  status: "closed",
  closedAt: "2026-09-30T10:00:00.000Z",
  createdAt: "2026-09-29T08:00:00.000Z",
  updatedAt: "2026-09-30T10:00:00.000Z",
  profile: { id: "00000000-0000-4000-8000-000000000002", fullName: "Остап Вигаданий", photoPath: null, profileUrl: "https://example.com/p" },
  comments: [{ id: "c", contractId: "x", body: "Коментар\nу два рядки", createdAt: "2026-09-29T12:30:00.000Z" }],
};

describe("contract export", () => {
  it("builds file names with a transliterated slug", () => {
    expect(slugify("Редизайн панелі «Ґанок» — етап №1")).toBe("redyzain-paneli-ganok-etap-no1");
    expect(contractFileName(contract, "pdf")).toBe("contract-redyzain-paneli-ganok-etap-no1-2026-09-29.pdf");
    expect(slugify("!!!")).toBe("contract");
  });

  it("produces a Word file containing the Ukrainian text and line breaks", async () => {
    const buf = await buildContractDocx(contract);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Редизайн панелі «Ґанок» — етап №1");
    expect(xml).toContain("Другий рядок з Ї та Є.");
    expect(xml).toContain("<w:br/>");
    expect(xml).toContain("UPWORK / PROFILE MANAGER");
    expect(Object.keys(zip.files).some((f) => f.startsWith("word/fonts/"))).toBe(true);
  });

  it("produces a PDF with the Cyrillic font embedded", async () => {
    const buf = await buildContractPdf(contract);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    const text = buf.toString("latin1");
    expect(text).toMatch(/FontFile2/);
    expect(text).toMatch(/Roboto/);
  }, 30_000);
});
