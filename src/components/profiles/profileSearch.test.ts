import { describe, expect, it } from "vitest";
import { matchesProfileSearch } from "./ProfilesTable";

describe("profile search", () => {
  const p = { fullName: "Остап Вигаданий", title: "Frontend Developer | Web Apps" };
  it("matches full name and Title, case-insensitively", () => {
    expect(matchesProfileSearch(p, "остап")).toBe(true);
    expect(matchesProfileSearch(p, "WEB APPS")).toBe(true);
    expect(matchesProfileSearch(p, "  ")).toBe(true);
    expect(matchesProfileSearch(p, "designer")).toBe(false);
    expect(matchesProfileSearch({ fullName: "X", title: null }, "x")).toBe(true);
  });
});
