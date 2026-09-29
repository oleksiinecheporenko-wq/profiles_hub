import { beforeEach, describe, expect, it } from "vitest";
import { MockRepository, monotonicClock } from "@/lib/data/mock";
import { buildSampleDataset } from "@/lib/data/sample";
import { actionGroup, entryChanges, summarizeEntry } from "./activity";
import { draftFromVersion } from "./versions";

let repo: MockRepository;
const OSTAP = "00000000-0000-4000-8000-000000000001";

beforeEach(async () => {
  let tx = 0;
  repo = new MockRepository(await buildSampleDataset(), {
    now: monotonicClock(),
    newId: () => crypto.randomUUID(),
    nextTxId: () => ++tx,
  });
});

const latest = async (profileId = OSTAP) => (await repo.listActivity({ profileId, limit: 1 })).entries[0];

describe("activity summaries", () => {
  it("renders the templates from Part A", async () => {
    await repo.changeProfileStatus(OSTAP, "hold", "Пауза");
    expect(summarizeEntry(await latest())).toBe("Статус змінено з Active на Hold. Причина: Пауза");

    await repo.updateProfileFields(OSTAP, { email: "new@example.com" });
    expect(summarizeEntry(await latest())).toBe("Змінено поле Email");

    const v = (await repo.getCurrentVersion(OSTAP))!;
    await repo.applyDailyChange(v.id, { field: "rate", value: 45 }, v.updatedAt);
    expect(summarizeEntry(await latest())).toBe("Rate змінено з $40/год на $45/год");

    const cur = (await repo.getCurrentVersion(OSTAP))!;
    await repo.createGlobalVersion(OSTAP, { ...draftFromVersion(cur, "2026-09-29") });
    expect(summarizeEntry(await latest())).toBe("Створено глобальне оновлення від 29.09.2026");

    const archived = (await repo.getVersion(cur.id))!;
    await repo.editGlobalVersion(
      archived.id,
      { updateDate: archived.updateDate, content: { ...archived.content, title: "X", skills: ["A"] } },
      archived.updatedAt,
    );
    expect(summarizeEntry(await latest())).toBe("Відредаговано версію від 15.06.2026 (Title, Skills)");
  });

  it("names contracts in close and comment entries", async () => {
    const [contract] = await repo.listContracts({ profileId: OSTAP });
    await repo.setContractStatus(contract.id, "closed");
    expect(summarizeEntry(await latest())).toBe(`Контракт «${contract.title}» закрито`);
    await repo.addContractComment(contract.id, "Нотатка");
    expect(summarizeEntry(await latest())).toBe(`Додано коментар до контракту «${contract.title}»`);
  });

  it("summarizes collection daily changes and lists было → стало", async () => {
    const v = (await repo.getCurrentVersion(OSTAP))!;
    const item = v.content.portfolio[0];
    await repo.applyDailyChange(v.id, { field: "portfolio", op: "update", item: { ...item, title: "Нова назва" } }, v.updatedAt);
    const entry = await latest();
    expect(summarizeEntry(entry)).toBe("Portfolio: змінено «Нова назва»");
    expect(entryChanges(entry)).toEqual([
      { label: "Portfolio · Нова назва", old: `Назва: ${item.title}`, new: "Назва: Нова назва" },
    ]);
  });

  it("maps actions to filter groups", () => {
    expect(actionGroup("profile.status_changed")).toBe("status");
    expect(actionGroup("version.daily_change")).toBe("updates");
    expect(actionGroup("contract.comment_added")).toBe("contracts");
    expect(actionGroup("profile.updated")).toBe("main");
  });
});
