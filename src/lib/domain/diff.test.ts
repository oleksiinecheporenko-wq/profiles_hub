import { describe, expect, it } from "vitest";
import { compareCollection, compareSkills, compareVersions, onlyDifferences } from "./diff";
import type { OtherExperience, VersionContent } from "./types";
import { emptyVersionContent } from "./versions";

const exp = (n: number, title = `Item ${n}`, description: string | null = null): OtherExperience => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  title,
  description,
});

const content = (o: Partial<VersionContent> = {}): VersionContent => ({ ...emptyVersionContent("T"), ...o });

describe("compareVersions", () => {
  it("marks scalar fields changed, ignoring whitespace and blank vs null", () => {
    const rows = compareVersions(
      content({ title: "Dev", rate: 35, description: "Text  ", additional_info: "" }),
      content({ title: "Senior Dev", rate: 35.0, description: "Text", additional_info: null }),
    );
    const byField = Object.fromEntries(rows.map((r) => [r.field, r.changed]));
    expect(byField).toMatchObject({ title: true, rate: false, description: false, additional_info: false });
  });

  it("keeps the Part B order", () => {
    expect(compareVersions(content(), content()).map((r) => r.field)).toEqual([
      "title",
      "rate",
      "description",
      "portfolio",
      "skills",
      "project_catalog",
      "certifications",
      "employment_history",
      "other_experiences",
      "additional_info",
    ]);
  });
});

describe("compareSkills", () => {
  it("lists added and removed tags", () => {
    const row = compareSkills(["A", "B", "C"], ["B", "C", "D"]);
    expect(row).toMatchObject({ added: ["D"], removed: ["A"], reordered: false, changed: true });
  });

  it("treats case differences as the same tag and detects reordering", () => {
    expect(compareSkills(["Design"], ["design"]).changed).toBe(false);
    expect(compareSkills(["A", "B"], ["B", "A"])).toMatchObject({ added: [], removed: [], reordered: true, changed: true });
  });
});

describe("compareCollection", () => {
  it("matches items by id: changed, added, removed", () => {
    const row = compareCollection(
      "other_experiences",
      [exp(1), exp(2), exp(3)],
      [exp(1), exp(2, "Renamed"), exp(4)],
    );
    const status = Object.fromEntries(row.pairs.map((p) => [p.key, p.status]));
    expect(status).toEqual({
      [`m:${exp(1).id}`]: "same",
      [`m:${exp(2).id}`]: "changed",
      [`l:${exp(3).id}`]: "removed",
      [`r:${exp(4).id}`]: "added",
    });
    expect(row.pairs.find((p) => p.status === "changed")?.changedKeys).toEqual(["title"]);
    expect(row.changed).toBe(true);
    expect(row.reordered).toBe(false);
  });

  it("places a removed item where it was on the left", () => {
    const row = compareCollection("other_experiences", [exp(1), exp(2), exp(3)], [exp(1), exp(3)]);
    expect(row.pairs.map((p) => p.status)).toEqual(["same", "removed", "same"]);
  });

  it("detects reordering of matched items without marking them changed", () => {
    const row = compareCollection("other_experiences", [exp(1), exp(2)], [exp(2), exp(1)]);
    expect(row.pairs.every((p) => p.status === "same")).toBe(true);
    expect(row.reordered).toBe(true);
    expect(row.changed).toBe(true);
  });

  it("falls back to content matching when ids differ", () => {
    const left = [{ ...exp(1, "Mentoring"), id: "11111111-1111-4111-8111-111111111111" }];
    const right = [{ ...exp(2, "  mentoring "), description: "new" }];
    const row = compareCollection("other_experiences", left, right);
    expect(row.pairs).toHaveLength(1);
    expect(row.pairs[0]).toMatchObject({ status: "changed", matchedByContent: true, changedKeys: ["title", "description"] });
  });

  it("does not mark the whole collection when one item changed", () => {
    const row = compareCollection("other_experiences", [exp(1), exp(2)], [exp(1), exp(2, "X")]);
    expect(row.pairs.filter((p) => p.status !== "same")).toHaveLength(1);
  });
});

describe("onlyDifferences", () => {
  it("hides equal rows and unchanged collection items", () => {
    const rows = compareVersions(
      content({ title: "Same", other_experiences: [exp(1), exp(2)] }),
      content({ title: "Same", other_experiences: [exp(1), exp(2, "Changed")] }),
    );
    const filtered = onlyDifferences(rows);
    expect(filtered.map((r) => r.field)).toEqual(["other_experiences"]);
    const collection = filtered[0];
    expect(collection.kind === "collection" && collection.pairs.map((p) => p.status)).toEqual(["changed"]);
  });

  it("keeps the full list when the order changed", () => {
    const filtered = onlyDifferences(
      compareVersions(content({ other_experiences: [exp(1), exp(2)] }), content({ other_experiences: [exp(2), exp(1)] })),
    );
    expect(filtered[0].kind === "collection" && filtered[0].pairs).toHaveLength(2);
  });

  it("returns nothing for identical versions", () => {
    const c = content({ skills: ["A"], other_experiences: [exp(1)] });
    expect(onlyDifferences(compareVersions(c, structuredClone(c)))).toEqual([]);
  });
});
