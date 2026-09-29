// Runs supabase/migrations and supabase/seed.sql on an embedded Postgres (PGlite) and
// exercises the Postgres functions and log triggers. Supabase-specific objects the
// migrations touch (roles, storage.buckets) are stubbed.

import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { applyDailyChange } from "@/lib/domain/dailyChanges";
import { buildSampleDataset } from "./sample";
import { versionFromRow, type ProfileVersionRow } from "./rows";

const root = new URL("../../../supabase/", import.meta.url);
let db: PGlite;

async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  const result = await db.query<T>(sql, params);
  return result.rows[0];
}

async function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

async function errorCode(sql: string, params: unknown[] = []): Promise<string | undefined> {
  try {
    await db.query(sql, params);
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

async function currentVersion(profileId: string): Promise<ProfileVersionRow> {
  return one<ProfileVersionRow>(
    "select * from public.profile_versions where profile_id = $1 and is_current",
    [profileId],
  );
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema storage;
    create table storage.buckets (
      id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]
    );
  `);
  const migrations = readdirSync(new URL("migrations/", root)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations) {
    await db.exec(readFileSync(new URL(`migrations/${file}`, root), "utf8"));
  }
  await db.exec(readFileSync(new URL("seed.sql", root), "utf8"));
}, 60_000);

describe("migrations + seed", () => {
  it("loads the sample data set", async () => {
    const data = await buildSampleDataset();
    const counts = await one<Record<string, number>>(`
      select
        (select count(*)::int from public.profiles) as profiles,
        (select count(*)::int from public.profile_versions) as versions,
        (select count(*)::int from public.daily_changes) as daily,
        (select count(*)::int from public.contracts) as contracts,
        (select count(*)::int from public.activity_log) as activity,
        (select count(*)::int from public.activity_feed) as feed,
        (select count(*)::int from storage.buckets) as buckets
    `);
    expect(counts).toEqual({
      profiles: data.profiles.length,
      versions: data.versions.length,
      daily: data.dailyChanges.length,
      contracts: data.contracts.length,
      activity: data.activity.length,
      feed: new Set(data.activity.map((a) => a.txId)).size,
      buckets: 2,
    });
  });

  it("profile_overview shows the current title and active contract count", async () => {
    const rows = await all<{ full_name: string; title: string; active_contracts_count: number }>(
      "select full_name, title, active_contracts_count from public.profile_overview order by full_name",
    );
    expect(rows).toHaveLength(6);
    const ostap = rows.find((r) => r.full_name === "Остап Вигаданий")!;
    expect(ostap.title).toBe("Senior Frontend Developer | Web Apps & Design Systems");
    expect(ostap.active_contracts_count).toBe(1);
  });

  it("enables RLS on every table", async () => {
    const rows = await all<{ relname: string; relrowsecurity: boolean }>(`
      select c.relname, c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    `);
    expect(rows.length).toBe(7);
    expect(rows.every((r) => r.relrowsecurity)).toBe(true);
  });
});

describe("functions and log triggers", () => {
  it("create_profile inserts the profile and one current version in one logged transaction", async () => {
    const p = await one<{ id: string }>("select * from public.create_profile('Тест Тестович', 'hold', ' Title ', null, null)");
    const versions = await all<ProfileVersionRow>("select * from public.profile_versions where profile_id = $1", [p.id]);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ is_current: true, title: "Title" });

    const log = await all<{ action: string; tx_id: string; entity_type: string }>(
      "select action, tx_id::text, entity_type from public.activity_log where profile_id = $1",
      [p.id],
    );
    expect(log.map((l) => l.entity_type).sort()).toEqual(["profile", "version"]);
    expect(new Set(log.map((l) => l.action))).toEqual(new Set(["profile.created"]));
    expect(new Set(log.map((l) => l.tx_id)).size).toBe(1);
  });

  it("rejects an empty name", async () => {
    expect(await errorCode("select public.create_profile('  ')")).toBe("UP422");
  });

  it("apply_daily_change: scalar update, no-op, conflict and non-current", async () => {
    const p = await one<{ id: string }>("select id from public.profiles where full_name = 'Остап Вигаданий'");
    const v = await currentVersion(p.id);

    const updated = await one<ProfileVersionRow>(
      "select * from public.apply_daily_change($1, 'rate', '{\"value\": 41.5}', $2)",
      [v.id, v.updated_at],
    );
    expect(Number(updated.rate)).toBe(41.5);
    const change = await one<{ old_value: unknown; new_value: unknown; change_type: string }>(
      "select * from public.daily_changes where version_id = $1 order by changed_at desc limit 1",
      [v.id],
    );
    expect(change).toMatchObject({ change_type: "update", old_value: 40, new_value: 41.5 });

    // Same value again: nothing recorded.
    const before = await one<{ n: number }>("select count(*)::int n from public.daily_changes where version_id = $1", [v.id]);
    await db.query("select public.apply_daily_change($1, 'rate', '{\"value\": 41.5}', $2)", [v.id, updated.updated_at]);
    const after = await one<{ n: number }>("select count(*)::int n from public.daily_changes where version_id = $1", [v.id]);
    expect(after.n).toBe(before.n);

    // Stale timestamp.
    expect(
      await errorCode("select public.apply_daily_change($1, 'rate', '{\"value\": 50}', $2)", [v.id, v.updated_at]),
    ).toBe("UP409");

    // Archived version.
    const archived = await one<ProfileVersionRow>(
      "select * from public.profile_versions where profile_id = $1 and not is_current limit 1",
      [p.id],
    );
    expect(
      await errorCode("select public.apply_daily_change($1, 'rate', '{\"value\": 1}', $2)", [
        archived.id,
        archived.updated_at,
      ]),
    ).toBe("UP423");

    const log = await one<{ action: string; details: { changes: Record<string, unknown> } }>(
      "select action, details from public.activity_log where entity_id = $1 order by occurred_at desc, id desc limit 1",
      [v.id],
    );
    expect(log.action).toBe("version.daily_change");
    expect(Object.keys(log.details.changes)).toEqual(["rate"]);
  });

  it("apply_daily_change on collections matches the TypeScript rules", async () => {
    const p = await one<{ id: string }>("select id from public.profiles where full_name = 'Марта Прикладна'");
    const newItem = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Новий кейс",
      description: null,
      url: null,
      image_path: null,
    };

    const steps = async (build: (content: ReturnType<typeof versionFromRow>["content"]) => {
      sql: Record<string, unknown>;
      ts: Parameters<typeof applyDailyChange>[1];
    }) => {
      const row = await currentVersion(p.id);
      const version = versionFromRow(row);
      const { sql, ts } = build(version.content);
      const expected = applyDailyChange(version.content, ts)!;
      const next = await one<ProfileVersionRow>(
        "select * from public.apply_daily_change($1, 'portfolio', $2::jsonb, $3)",
        [row.id, JSON.stringify(sql), row.updated_at],
      );
      const record = await one<{ change_type: string; item_id: string | null; old_value: unknown; new_value: unknown }>(
        "select change_type, item_id, old_value, new_value from public.daily_changes where version_id = $1 order by changed_at desc, id desc limit 1",
        [row.id],
      );
      expect(versionFromRow(next).content.portfolio).toEqual(expected.content.portfolio);
      expect(record).toEqual({
        change_type: expected.records[0].changeType,
        item_id: expected.records[0].itemId,
        old_value: expected.records[0].oldValue,
        new_value: expected.records[0].newValue,
      });
    };

    await steps(() => ({
      sql: { op: "add", item: newItem, index: 0 },
      ts: { field: "portfolio", op: "add", item: newItem, index: 0 },
    }));
    await steps(() => ({
      sql: { op: "update", item: { ...newItem, title: "Змінений кейс" } },
      ts: { field: "portfolio", op: "update", item: { ...newItem, title: "Змінений кейс" } },
    }));
    await steps((c) => {
      const ids = c.portfolio.map((i) => i.id).reverse();
      return { sql: { op: "reorder", ids }, ts: { field: "portfolio", op: "reorder", ids } };
    });
    await steps(() => ({
      sql: { op: "remove", item_id: newItem.id },
      ts: { field: "portfolio", op: "remove", itemId: newItem.id },
    }));
  });

  it("create_global_version keeps exactly one current version and logs one transaction", async () => {
    const p = await one<{ id: string }>("select id from public.profiles where full_name = 'Ірина Зразкова'");
    const old = await currentVersion(p.id);
    const payload = {
      update_date: "2026-09-29",
      content: { ...versionFromRow(old).content, title: "Нова версія" },
    };
    const created = await one<ProfileVersionRow>(
      "select * from public.create_global_version($1, $2::jsonb)",
      [p.id, JSON.stringify(payload)],
    );
    const current = await all("select id from public.profile_versions where profile_id = $1 and is_current", [p.id]);
    expect(current).toEqual([{ id: created.id }]);
    expect(created.skills).toEqual(old.skills);

    const tx = await all<{ action: string }>(
      "select action from public.activity_log where tx_id = (select tx_id from public.activity_log where entity_id = $1)",
      [created.id],
    );
    expect(tx).toHaveLength(2);
    expect(tx.every((r) => r.action === "version.created")).toBe(true);
  });

  it("edit_global_version edits an archived version without daily changes", async () => {
    const archived = await one<ProfileVersionRow>(
      "select * from public.profile_versions where not is_current order by created_at limit 1",
    );
    const dailyBefore = await one<{ n: number }>("select count(*)::int n from public.daily_changes");
    const payload = { update_date: archived.update_date, content: { ...versionFromRow(archived).content, title: "Правка архіву" } };
    const edited = await one<ProfileVersionRow>(
      "select * from public.edit_global_version($1, $2::jsonb, $3)",
      [archived.id, JSON.stringify(payload), archived.updated_at],
    );
    expect(edited).toMatchObject({ title: "Правка архіву", is_current: false });
    const dailyAfter = await one<{ n: number }>("select count(*)::int n from public.daily_changes");
    expect(dailyAfter.n).toBe(dailyBefore.n);
    const log = await one<{ action: string; details: { changes: Record<string, unknown> } }>(
      "select action, details from public.activity_log where entity_id = $1 order by occurred_at desc limit 1",
      [archived.id],
    );
    expect(log.action).toBe("version.edited");
    expect(Object.keys(log.details.changes)).toEqual(["title"]);
  });

  it("change_profile_status stores the reason and skips a no-op", async () => {
    const p = await one<{ id: string; status: string }>("select id, status from public.profiles where full_name = 'Богдан Тестенко'");
    await db.query("select public.change_profile_status($1, 'active', 'Повернулися до роботи')", [p.id]);
    await db.query("select public.change_profile_status($1, 'active', 'Вдруге')", [p.id]);
    const logs = await all<{ details: { reason?: string; changes: { status: { old: string; new: string } } } }>(
      "select details from public.activity_log where profile_id = $1 and action = 'profile.status_changed' and tx_id > 0",
      [p.id],
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].details.reason).toBe("Повернулися до роботи");
    expect(logs[0].details.changes.status).toEqual({ old: p.status, new: "active" });
  });

  it("set_profile_languages upserts, rejects duplicates and logs only real changes", async () => {
    const p = await one<{ id: string }>("select id from public.profiles where full_name = 'Остап Вигаданий'");
    const count = async () =>
      (await one<{ n: number }>("select count(*)::int n from public.activity_log where profile_id = $1 and entity_type = 'profile_language'", [p.id])).n;

    const before = await count();
    await db.query("select public.set_profile_languages($1, $2::jsonb)", [
      p.id,
      JSON.stringify([
        { language: "Ukrainian", level: "native" },
        { language: "English", level: "fluent" },
      ]),
    ]);
    expect(await count()).toBe(before);

    const rows = await all<{ language: string; position: number }>(
      "select language, position from public.set_profile_languages($1, $2::jsonb)",
      [p.id, JSON.stringify([{ language: "English", level: "native" }, { language: "German", level: "basic" }])],
    );
    expect(rows).toEqual([
      { language: "English", position: 0 },
      { language: "German", position: 1 },
    ]);
    expect(await count()).toBe(before + 3); // delete Ukrainian, update English, insert German

    expect(
      await errorCode("select public.set_profile_languages($1, $2::jsonb)", [
        p.id,
        JSON.stringify([{ language: "English", level: "basic" }, { language: "English", level: "native" }]),
      ]),
    ).toBe("UP410");
  });

  it("update_profile_fields patches only given keys and rejects unknown ones", async () => {
    const p = await one<{ id: string; email: string }>("select id, email from public.profiles where full_name = 'Марта Прикладна'");
    const updated = await one<{ email: string; phone: string | null; categories: string[] }>(
      "select * from public.update_profile_fields($1, $2::jsonb)",
      [p.id, JSON.stringify({ phone: "+380 00 000 00 02", categories: ["B", "A"] })],
    );
    expect(updated).toMatchObject({ email: p.email, phone: "+380 00 000 00 02", categories: ["B", "A"] });
    expect(
      await errorCode("select public.update_profile_fields($1, '{\"status\": \"ban\"}'::jsonb)", [p.id]),
    ).toBe("UP422");
  });

  it("contracts: create, edit, close, reopen, comment, soft delete", async () => {
    const p = await one<{ id: string }>("select id from public.profiles limit 1");
    const c = await one<{ id: string; status: string; updated_at: string }>(
      "select * from public.create_contract($1, '2026-09-29', 'Новий контракт', 30, null, $2)",
      [p.id, "Рядок 1\n\n  Рядок 2"],
    );
    expect(c.status).toBe("active");
    expect((await one<{ dialog: string }>("select dialog from public.contracts where id = $1", [c.id])).dialog).toBe(
      "Рядок 1\n\n  Рядок 2",
    );

    expect(
      await errorCode(
        "select public.update_contract($1, $2, '2026-09-29', 'X', null, null, null, '2000-01-01T00:00:00Z')",
        [c.id, p.id],
      ),
    ).toBe("UP409");

    const closed = await one<{ status: string; closed_at: string | null }>(
      "select * from public.set_contract_status($1, 'closed')",
      [c.id],
    );
    expect(closed.status).toBe("closed");
    expect(closed.closed_at).not.toBeNull();
    const reopened = await one<{ closed_at: string | null }>("select * from public.set_contract_status($1, 'active')", [c.id]);
    expect(reopened.closed_at).toBeNull();

    await db.query("select public.add_contract_comment($1, 'Коментар')", [c.id]);
    await db.query("select public.soft_delete_contract($1)", [c.id]);
    expect(await errorCode("select public.add_contract_comment($1, 'Ще')", [c.id])).toBe("UP404");
    expect(await errorCode("select public.soft_delete_contract($1)", [c.id])).toBe("UP404");

    const actions = await all<{ action: string }>(
      "select distinct on (tx_id) action from public.activity_log where entity_id = $1 or (entity_type = 'contract_comment' and details->'row'->>'contract_id' = $1::text) order by tx_id",
      [c.id],
    );
    expect(actions.map((a) => a.action)).toEqual([
      "contract.created",
      "contract.closed",
      "contract.reopened",
      "contract.comment_added",
      "contract.deleted",
    ]);
  });

  it("log rows carry meta with the entity's identifying context", async () => {
    const c = await one<{ id: string }>("select id from public.contracts where deleted_at is null limit 1");
    await db.query("select public.set_contract_status($1, 'closed')", [c.id]);
    const log = await one<{ details: { meta: { title: string } } }>(
      "select details from public.activity_log where entity_id = $1 order by occurred_at desc, tx_id desc limit 1",
      [c.id],
    );
    const title = (await one<{ title: string }>("select title from public.contracts where id = $1", [c.id])).title;
    expect(log.details.meta).toEqual({ title });

    const v = await one<ProfileVersionRow & { date_text: string }>(
      "select *, update_date::text as date_text from public.profile_versions where is_current limit 1",
    );
    await db.query("select public.apply_daily_change($1, 'title', '{\"value\": \"Meta test\"}', $2)", [v.id, v.updated_at]);
    const vlog = await one<{ details: { meta: { update_date: string } } }>(
      "select details from public.activity_log where entity_id = $1 order by occurred_at desc, tx_id desc limit 1",
      [v.id],
    );
    expect(vlog.details.meta.update_date).toBe(v.date_text);
  });

  it("delete_profile removes everything in one logged transaction", async () => {
    const p = await one<{ id: string; full_name: string }>(
      "select id, full_name from public.profiles where full_name = 'Соломія-Олександра Демченко-Прикладна'",
    );
    const result = await one<{ delete_profile: { full_name: string; portfolio_images: string[] } }>(
      "select public.delete_profile($1)",
      [p.id],
    );
    expect(result.delete_profile.full_name).toBe(p.full_name);

    const left = await one<Record<string, number>>(
      `select
        (select count(*)::int from public.profiles where id = $1) as profiles,
        (select count(*)::int from public.profile_versions where profile_id = $1) as versions,
        (select count(*)::int from public.daily_changes where profile_id = $1) as daily,
        (select count(*)::int from public.contracts where profile_id = $1) as contracts`,
      [p.id],
    );
    expect(left).toEqual({ profiles: 0, versions: 0, daily: 0, contracts: 0 });

    const tx = await all<{ action: string; entity_type: string }>(
      "select action, entity_type from public.activity_log where tx_id = (select tx_id from public.activity_log where entity_id = $1 and action = 'profile.deleted' and entity_type = 'profile')",
      [p.id],
    );
    expect(new Set(tx.map((r) => r.action))).toEqual(new Set(["profile.deleted"]));
    expect(tx.map((r) => r.entity_type)).toEqual(expect.arrayContaining(["profile", "version", "contract"]));

    expect(await errorCode("select public.delete_profile($1)", [p.id])).toBe("UP404");
  });

  it("direct edits without context get a generic action", async () => {
    const p = await one<{ id: string }>("select id from public.profiles limit 1");
    await db.query("update public.profiles set address = 'Пряма правка' where id = $1", [p.id]);
    const log = await one<{ action: string; details: { changes: Record<string, unknown> } }>(
      "select action, details from public.activity_log where profile_id = $1 order by occurred_at desc, tx_id desc limit 1",
      [p.id],
    );
    expect(log.action).toBe("profile.updated");
    expect(Object.keys(log.details.changes)).toEqual(["address"]);
  });
});
