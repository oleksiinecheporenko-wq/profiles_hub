import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { RepositoryError } from "@/lib/domain/errors";
import { draftFromVersion } from "@/lib/domain/versions";
import { MockRepository, monotonicClock } from "./mock";
import { buildSampleDataset } from "./sample";
import { renderSeedSql } from "./seedSql";

let repo: MockRepository;

beforeEach(async () => {
  let tx = 0;
  repo = new MockRepository(await buildSampleDataset(), {
    now: monotonicClock(),
    newId: () => crypto.randomUUID(),
    nextTxId: () => ++tx,
  });
});

describe("sample data set", () => {
  it("matches Part A section 8", async () => {
    const data = await buildSampleDataset();
    expect(data.profiles).toHaveLength(6);
    expect(new Set(data.profiles.map((p) => p.status))).toEqual(
      new Set(["active", "hold", "ban", "back_to_developer"]),
    );
    for (const p of data.profiles) {
      const versions = data.versions.filter((v) => v.profileId === p.id);
      expect(versions.length).toBeGreaterThanOrEqual(2);
      expect(versions.length).toBeLessThanOrEqual(4);
      expect(versions.filter((v) => v.isCurrent)).toHaveLength(1);
    }
    expect(data.contracts).toHaveLength(5);
    expect(data.contracts.some((c) => c.status === "closed")).toBe(true);
    expect(data.comments.length).toBeGreaterThan(0);
    expect(data.dailyChanges.some((d) => d.changeType === "add")).toBe(true);
    expect(data.dailyChanges.some((d) => d.changeType === "update" && d.itemId)).toBe(true);
  });

  it("is deterministic and supabase/seed.sql is up to date", async () => {
    const sql = renderSeedSql(await buildSampleDataset());
    expect(renderSeedSql(await buildSampleDataset())).toBe(sql);
    const onDisk = readFileSync(new URL("../../../supabase/seed.sql", import.meta.url), "utf8");
    expect(onDisk.replace(/\r\n/g, "\n"), "run `npm run db:seed:generate`").toBe(sql);
  });
});

describe("MockRepository", () => {
  it("creates a profile with exactly one current version holding the title", async () => {
    const profile = await repo.createProfile({
      fullName: "  Нова Особа ",
      status: "active",
      title: "Tester",
      profileUrl: null,
      photoPath: null,
    });
    expect(profile.fullName).toBe("Нова Особа");
    const versions = await repo.listVersions(profile.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ isCurrent: true, title: "Tester" });
    const page = await repo.listActivity({ profileId: profile.id, limit: 10 });
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0].action).toBe("profile.created");
    expect(page.entries[0].rows.map((r) => r.entityType).sort()).toEqual(["profile", "version"]);
  });

  it("applies a daily change only to the current version and detects conflicts", async () => {
    const [profile] = await repo.listProfiles();
    const current = (await repo.getCurrentVersion(profile.id))!;
    const updated = await repo.applyDailyChange(current.id, { field: "rate", value: 99 }, current.updatedAt);
    expect(updated.content.rate).toBe(99);

    const history = await repo.listDailyChanges(current.id);
    expect(history[0]).toMatchObject({ field: "rate", oldValue: current.content.rate, newValue: 99 });

    await expect(
      repo.applyDailyChange(current.id, { field: "rate", value: 100 }, current.updatedAt),
    ).rejects.toMatchObject({ code: "conflict" });

    const archived = (await repo.listVersions(profile.id)).find((v) => !v.isCurrent)!;
    const archivedVersion = (await repo.getVersion(archived.id))!;
    await expect(
      repo.applyDailyChange(archived.id, { field: "rate", value: 1 }, archivedVersion.updatedAt),
    ).rejects.toMatchObject({ code: "not_current" });
  });

  it("creates a global version from the current one with the same item ids", async () => {
    const [profile] = await repo.listProfiles();
    const current = (await repo.getCurrentVersion(profile.id))!;
    const draft = draftFromVersion(current, "2026-09-29");
    const created = await repo.createGlobalVersion(profile.id, draft);

    expect(created.isCurrent).toBe(true);
    expect(created.content.portfolio.map((i) => i.id)).toEqual(current.content.portfolio.map((i) => i.id));
    const versions = await repo.listVersions(profile.id);
    expect(versions.filter((v) => v.isCurrent)).toEqual([expect.objectContaining({ id: created.id })]);

    const [entry] = (await repo.listActivity({ profileId: profile.id, limit: 1 })).entries;
    expect(entry.action).toBe("version.created");
    // Flipping the old version and inserting the new one are one transaction.
    expect(entry.rows).toHaveLength(2);
  });

  it("logs a status change with its reason and ignores a no-op", async () => {
    const [profile] = await repo.listProfiles();
    const target = profile.status === "hold" ? "active" : "hold";
    await repo.changeProfileStatus(profile.id, target, "Перевірка");
    await repo.changeProfileStatus(profile.id, target, "Ще раз");
    const entries = (await repo.listActivity({ profileId: profile.id, actions: ["profile.status_changed"], limit: 10 }))
      .entries;
    expect(entries[0].rows[0].details).toMatchObject({
      reason: "Перевірка",
      changes: { status: { old: profile.status, new: target } },
    });
    expect(entries.filter((e) => e.rows[0].details.reason === "Ще раз")).toHaveLength(0);
  });

  it("rolls back a failed transaction", async () => {
    const before = structuredClone(repo.state);
    const [profile] = await repo.listProfiles();
    await expect(
      repo.setProfileLanguages(profile.id, [
        { language: "English", level: "basic" },
        { language: "English", level: "fluent" },
      ]),
    ).rejects.toBeInstanceOf(RepositoryError);
    expect(repo.state).toEqual(before);
  });

  it("soft-deletes contracts and hides them everywhere", async () => {
    const [contract] = await repo.listContracts();
    await repo.softDeleteContract(contract.id);
    expect((await repo.listContracts()).some((c) => c.id === contract.id)).toBe(false);
    expect(await repo.getContract(contract.id)).toBeNull();
    await expect(repo.addContractComment(contract.id, "x")).rejects.toMatchObject({ code: "not_found" });
  });

  it("closes and reopens a contract", async () => {
    const contract = (await repo.listContracts()).find((c) => c.status === "active")!;
    const closed = await repo.setContractStatus(contract.id, "closed");
    expect(closed.closedAt).not.toBeNull();
    const reopened = await repo.setContractStatus(contract.id, "active");
    expect(reopened.closedAt).toBeNull();
    const actions = (await repo.listActivity({ limit: 2 })).entries.map((e) => e.action);
    expect(actions).toEqual(["contract.reopened", "contract.closed"]);
  });

  it("deletes a profile with everything attached and logs one entry", async () => {
    const [contract] = await repo.listContracts();
    const profileId = contract.profileId;
    const detail = (await repo.getProfile(profileId))!;
    const deleted = await repo.deleteProfile(profileId);
    expect(deleted.fullName).toBe(detail.profile.fullName);
    expect(await repo.getProfile(profileId)).toBeNull();
    expect(await repo.listVersions(profileId)).toEqual([]);
    expect((await repo.listContracts()).some((c) => c.profileId === profileId)).toBe(false);
    expect(repo.state.dailyChanges.some((d) => d.profileId === profileId)).toBe(false);

    const [entry] = (await repo.listActivity({ limit: 1 })).entries;
    expect(entry.action).toBe("profile.deleted");
    expect(entry.profile).toBeNull();
    expect(new Set(entry.rows.map((r) => r.action))).toEqual(new Set(["profile.deleted"]));
    await expect(repo.deleteProfile(profileId)).rejects.toMatchObject({ code: "not_found" });
  });

  it("paginates activity by cursor without gaps or repeats", async () => {
    const all = (await repo.listActivity({ limit: 1000 })).entries;
    const seen: number[] = [];
    let cursor = undefined as undefined | { occurredAt: string; txId: number };
    do {
      const page = await repo.listActivity({ limit: 7, before: cursor });
      seen.push(...page.entries.map((e) => e.txId));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen).toEqual(all.map((e) => e.txId));
  });
});
