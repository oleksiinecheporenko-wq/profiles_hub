import { describe, expect, it } from "vitest";
import { applyDailyChange } from "./dailyChanges";
import { RepositoryError } from "./errors";
import type { PortfolioItem, VersionContent } from "./types";
import { emptyVersionContent } from "./versions";

const item = (n: number, title = `Item ${n}`): PortfolioItem => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  title,
  description: null,
  url: null,
  image_path: null,
});

function content(overrides: Partial<VersionContent> = {}): VersionContent {
  return { ...emptyVersionContent("Old title"), rate: 35, skills: ["A", "B"], ...overrides };
}

describe("applyDailyChange", () => {
  it("records one update with old and new values for scalar fields", () => {
    const result = applyDailyChange(content(), { field: "rate", value: 40 });
    expect(result?.content.rate).toBe(40);
    expect(result?.records).toEqual([
      { field: "rate", changeType: "update", itemId: null, oldValue: 35, newValue: 40 },
    ]);
  });

  it("returns null when a scalar value does not change", () => {
    expect(applyDailyChange(content(), { field: "title", value: "Old title" })).toBeNull();
  });

  it("records skills as one record with the old and new arrays", () => {
    const result = applyDailyChange(content(), { field: "skills", value: ["B", "C"] });
    expect(result?.records).toEqual([
      { field: "skills", changeType: "update", itemId: null, oldValue: ["A", "B"], newValue: ["B", "C"] },
    ]);
  });

  it("adds a collection item without inventing an old value", () => {
    const result = applyDailyChange(content({ portfolio: [item(1)] }), {
      field: "portfolio",
      op: "add",
      item: item(2),
    });
    expect(result?.content.portfolio.map((i) => i.id)).toEqual([item(1).id, item(2).id]);
    expect(result?.records).toEqual([
      { field: "portfolio", changeType: "add", itemId: item(2).id, oldValue: null, newValue: item(2) },
    ]);
  });

  it("adds at a given index", () => {
    const result = applyDailyChange(content({ portfolio: [item(1), item(2)] }), {
      field: "portfolio",
      op: "add",
      item: item(3),
      index: 0,
    });
    expect(result?.content.portfolio.map((i) => i.id)).toEqual([item(3).id, item(1).id, item(2).id]);
  });

  it("updates one item and records old and new item", () => {
    const edited = item(1, "New title");
    const result = applyDailyChange(content({ portfolio: [item(1), item(2)] }), {
      field: "portfolio",
      op: "update",
      item: edited,
    });
    expect(result?.content.portfolio).toEqual([edited, item(2)]);
    expect(result?.records[0]).toMatchObject({ changeType: "update", itemId: item(1).id, oldValue: item(1), newValue: edited });
  });

  it("removes an item and records the old item with a null new value", () => {
    const result = applyDailyChange(content({ portfolio: [item(1), item(2)] }), {
      field: "portfolio",
      op: "remove",
      itemId: item(1).id,
    });
    expect(result?.content.portfolio).toEqual([item(2)]);
    expect(result?.records[0]).toMatchObject({ changeType: "remove", oldValue: item(1), newValue: null });
  });

  it("reorders and records old and new id lists", () => {
    const result = applyDailyChange(content({ portfolio: [item(1), item(2)] }), {
      field: "portfolio",
      op: "reorder",
      ids: [item(2).id, item(1).id],
    });
    expect(result?.content.portfolio).toEqual([item(2), item(1)]);
    expect(result?.records[0]).toMatchObject({
      changeType: "reorder",
      itemId: null,
      oldValue: [item(1).id, item(2).id],
      newValue: [item(2).id, item(1).id],
    });
  });

  it("rejects a reorder that is not a permutation", () => {
    expect(() =>
      applyDailyChange(content({ portfolio: [item(1), item(2)] }), {
        field: "portfolio",
        op: "reorder",
        ids: [item(1).id],
      }),
    ).toThrow(RepositoryError);
  });

  it("rejects adding an existing id and updating a missing one", () => {
    const c = content({ portfolio: [item(1)] });
    expect(() => applyDailyChange(c, { field: "portfolio", op: "add", item: item(1) })).toThrow(RepositoryError);
    expect(() => applyDailyChange(c, { field: "portfolio", op: "update", item: item(2) })).toThrow(RepositoryError);
  });

  it("does not mutate the input content", () => {
    const c = content({ portfolio: [item(1)] });
    const snapshot = structuredClone(c);
    applyDailyChange(c, { field: "portfolio", op: "remove", itemId: item(1).id });
    expect(c).toEqual(snapshot);
  });
});
