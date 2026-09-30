import { describe, expect, it } from "vitest";
import { skillsSchema, optionalEmail, optionalUrl } from "./common";
import { contractInputSchema } from "./contract";
import { profileFieldsPatchSchema } from "./profile";
import { certificationSchema, dailyChangeSchema, descriptionSchema, versionPayloadSchema } from "./version";
import { emptyVersionContent } from "@/lib/domain/versions";

describe("validation", () => {
  it("caps skills at 20 and rejects normalized duplicates", () => {
    const twenty = Array.from({ length: 20 }, (_, i) => `Skill ${i}`);
    expect(skillsSchema.safeParse(twenty).success).toBe(true);
    expect(skillsSchema.safeParse([...twenty, "One more"]).success).toBe(false);
    expect(skillsSchema.safeParse(["Design", "  design "]).success).toBe(false);
    expect(skillsSchema.parse(["  Web   Design "])).toEqual(["Web Design"]);
  });

  it("limits description to 5000 characters", () => {
    expect(descriptionSchema.safeParse("a".repeat(5000)).success).toBe(true);
    expect(descriptionSchema.safeParse("a".repeat(5001)).success).toBe(false);
    expect(descriptionSchema.parse("   ")).toBeNull();
  });

  it("validates email and http(s) URLs", () => {
    expect(optionalEmail.safeParse("person@example.com").success).toBe(true);
    expect(optionalEmail.safeParse("person@").success).toBe(false);
    expect(optionalEmail.parse("")).toBeNull();
    expect(optionalUrl.safeParse("https://example.com/x").success).toBe(true);
    expect(optionalUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(optionalUrl.safeParse("ftp://example.com").success).toBe(false);
  });

  it("validates collection items inside daily changes", () => {
    const ok = dailyChangeSchema.safeParse({
      field: "portfolio",
      op: "add",
      item: { id: crypto.randomUUID(), title: "Кейс", description: "", url: "", image_path: null },
    });
    expect(ok.success).toBe(true);
    if (ok.success && "item" in ok.data) expect(ok.data.item).toMatchObject({ description: null, url: null });

    const bad = dailyChangeSchema.safeParse({
      field: "portfolio",
      op: "add",
      item: { id: crypto.randomUUID(), title: "", url: "nope" },
    });
    expect(bad.success).toBe(false);
  });

  it("certifications have a period and a description", () => {
    const base = { id: crypto.randomUUID(), title: "Cert", issuer: null, description: "Опис" };
    expect(certificationSchema.safeParse({ ...base, date_from: "2024-01-01", date_to: "2025-01-01" }).success).toBe(true);
    expect(certificationSchema.safeParse({ ...base, date_from: "2025-01-01", date_to: "2024-01-01" }).success).toBe(false);
    expect(certificationSchema.safeParse({ ...base, date_from: null, date_to: null }).success).toBe(true);
  });

  it("rejects duplicate item ids in a version payload", () => {
    const id = crypto.randomUUID();
    const item = { id, title: "X", description: null };
    const payload = {
      updateDate: "2026-09-29",
      content: { ...emptyVersionContent("T"), other_experiences: [item, item] },
    };
    expect(versionPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it("accepts only known account fields", () => {
    expect(profileFieldsPatchSchema.safeParse({ email: "a@example.com" }).success).toBe(true);
    expect(profileFieldsPatchSchema.safeParse({ status: "ban" }).success).toBe(false);
    expect(profileFieldsPatchSchema.safeParse({}).success).toBe(false);
    expect(profileFieldsPatchSchema.safeParse({ timeZone: "Europe/Kyiv" }).success).toBe(true);
    expect(profileFieldsPatchSchema.safeParse({ timeZone: "Mars/Base" }).success).toBe(false);
  });

  it("keeps contract dialog text verbatim", () => {
    const dialog = "  Клієнт: привіт\n\n    Фрилансер: вітаю  ";
    const parsed = contractInputSchema.parse({
      profileId: crypto.randomUUID(),
      createdDate: "2026-09-29",
      title: " Контракт ",
      rate: 40,
      description: "",
      dialog,
    });
    expect(parsed.dialog).toBe(dialog);
    expect(parsed.title).toBe("Контракт");
    expect(parsed.description).toBeNull();
  });
});
