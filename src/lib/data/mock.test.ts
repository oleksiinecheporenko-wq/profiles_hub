import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { MockRepository, monotonicClock } from "./mock";
import { buildSampleDataset } from "./sample";
import { renderSeedSql } from "./seedSql";

let repo: MockRepository;

beforeEach(async () => {
  repo = new MockRepository(await buildSampleDataset(), { now: monotonicClock(), newId: () => crypto.randomUUID() });
});

describe("sample data", () => {
  it("covers every section and seed.sql is up to date", async () => {
    const data = await buildSampleDataset();
    expect(new Set(data.estimates.map((e) => e.status))).toEqual(new Set(["in_progress", "ready", "archived"]));
    const sql = renderSeedSql(data);
    const onDisk = readFileSync(new URL("../../../supabase/seed.sql", import.meta.url), "utf8");
    expect(onDisk.replace(/\r\n/g, "\n"), "run npm run db:seed:generate").toBe(sql);
  });
});

describe("estimate lifecycle", () => {
  it("goes from requests to ready to archive, and back on edit", async () => {
    const e = await repo.createEstimate({ clientName: "Клієнт", projectName: "Проєкт" });
    expect(e.status).toBe("in_progress");
    expect(e.rows).toHaveLength(11);

    const rows = e.rows.map((r, i) => (i === 1 ? { ...r, feature: "Login", realistic: 8 } : r));
    await repo.updateRows(e.id, rows);
    const ready = await repo.markReady(e.id);
    expect(ready.status).toBe("ready");
    expect(ready.readyAt).not.toBeNull();
    await expect(repo.updateRows(e.id, rows)).rejects.toMatchObject({ code: "wrong_status" });

    const reopened = await repo.reopen(e.id);
    expect(reopened).toMatchObject({ status: "in_progress", readyAt: null });
    await repo.markReady(e.id);

    await expect(repo.setNextSteps(e.id, [{ id: "s1", title: "Call", text: "" }])).resolves.toMatchObject({
      nextSteps: [{ title: "Call" }],
    });
    await expect(repo.archive(e.id)).rejects.toMatchObject({ code: "invalid" });
    await repo.setRate(e.id, 40);
    const archived = await repo.archive(e.id);
    expect(archived.status).toBe("archived");
    await expect(repo.setNextSteps(e.id, null)).rejects.toMatchObject({ code: "wrong_status" });
    await expect(repo.setRate(e.id, 50)).rejects.toMatchObject({ code: "wrong_status" });
    await expect(repo.updateInfo(e.id, { jobTitle: "x" })).rejects.toMatchObject({ code: "wrong_status" });
  });

  it("searches the archive by client, project, job title and developer", async () => {
    const byClient = await repo.listEstimates({ status: "archived", q: "крамниця" });
    expect(byClient.map((e) => e.clientName)).toEqual(["Умовна Крамниця"]);
    expect(await repo.listEstimates({ status: "archived", q: "fitness" })).toHaveLength(1);
    expect(await repo.listEstimates({ status: "archived", q: "Марта" })).toHaveLength(1);
    expect(await repo.listEstimates({ status: "archived", q: "немає такого" })).toHaveLength(0);
  });

  it("deletes an estimate with its files", async () => {
    const e = await repo.createEstimate({ clientName: "Тимчасовий", projectName: null });
    const target = await repo.createUploadTarget(e.id, "Фото 1.png");
    await repo.uploadFile(target.path, new Uint8Array([1, 2, 3]), "image/png");
    await repo.addFile(e.id, { path: target.path, name: "Фото 1.png", mimeType: "image/png", size: 3 });
    expect((await repo.getEstimate(e.id))!.files).toHaveLength(1);
    expect(await repo.deleteEstimate(e.id)).toEqual([target.path]);
    expect(await repo.getEstimate(e.id)).toBeNull();
  });
});
