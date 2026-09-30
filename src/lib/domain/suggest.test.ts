import { describe, expect, it } from "vitest";
import { suggestTags } from "./suggest";

describe("suggestTags", () => {
  const all = ["React", "Redux", "UI Design", "UX Research", "Prototyping", "react "];

  it("matches case-insensitively, prefix matches first", () => {
    expect(suggestTags(all, [], "re")).toEqual(["React", "Redux", "UX Research"]);
  });

  it("excludes selected tags and duplicates", () => {
    expect(suggestTags(all, ["react"], "re")).toEqual(["Redux", "UX Research"]);
  });

  it("returns nothing for an empty query and respects the limit", () => {
    expect(suggestTags(all, [], "  ")).toEqual([]);
    expect(suggestTags(all, [], "u", 2)).toHaveLength(2);
  });
});
