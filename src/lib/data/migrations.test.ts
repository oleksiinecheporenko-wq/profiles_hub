// Runs every migration (including the Profiles Hub teardown) and seed.sql on an
// embedded Postgres (PGlite). Supabase roles and storage.buckets are stubbed.

import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { buildSampleDataset } from "./sample";

const root = new URL("../../../supabase/", import.meta.url);
let db: PGlite;

async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0];
}

async function errorCode(sql: string, params: unknown[] = []): Promise<string | undefined> {
  try {
    await db.query(sql, params);
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
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
  for (const file of migrations) await db.exec(readFileSync(new URL(`migrations/${file}`, root), "utf8"));
  await db.exec(readFileSync(new URL("seed.sql", root), "utf8"));
}, 60_000);

describe("estimation hub schema", () => {
  it("removes every Profiles Hub table and type", async () => {
    const left = await one<{ tables: number; types: number }>(`
      select
        (select count(*)::int from pg_tables where schemaname = 'public'
           and tablename in ('profiles','profile_versions','daily_changes','contracts','activity_log','skill_catalog')) as tables,
        (select count(*)::int from pg_type t join pg_namespace n on n.oid = t.typnamespace
           where n.nspname = 'public' and t.typname in ('profile_status','contract_status','language_level')) as types
    `);
    expect(left).toEqual({ tables: 0, types: 0 });
  });

  it("loads the sample data and the materials bucket", async () => {
    const data = await buildSampleDataset();
    const counts = await one<Record<string, number>>(`
      select (select count(*)::int from public.estimates) as estimates,
             (select count(*)::int from storage.buckets where id = 'estimate-materials') as buckets`);
    expect(counts).toEqual({ estimates: data.estimates.length, buckets: 1 });
  });

  it("keeps status and timestamps consistent", async () => {
    const e = await one<{ id: string }>("select id from public.estimates where status = 'in_progress' limit 1");
    // ready without ready_at, archived without a rate: refused.
    expect(await errorCode("update public.estimates set status = 'ready' where id = $1", [e.id])).toBe("23514");
    expect(
      await errorCode(
        "update public.estimates set status = 'archived', ready_at = now(), archived_at = now(), rate = null where id = $1",
        [e.id],
      ),
    ).toBe("23514");
    expect(await errorCode("update public.estimates set status = 'ready', ready_at = now() where id = $1", [e.id])).toBeUndefined();
  });

  it("enables RLS and cascades files with their estimate", async () => {
    const rls = await one<{ ok: boolean }>(`
      select bool_and(relrowsecurity) as ok from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'`);
    expect(rls.ok).toBe(true);
    const e = await one<{ id: string }>("select id from public.estimates limit 1");
    await db.query("insert into public.estimate_files (estimate_id, path, name) values ($1, 'x/1', 'a.png')", [e.id]);
    await db.query("delete from public.estimates where id = $1", [e.id]);
    expect((await one<{ n: number }>("select count(*)::int n from public.estimate_files where path = 'x/1'")).n).toBe(0);
  });

  it("bumps updated_at on change", async () => {
    const before = await one<{ id: string; updated_at: string }>("select id, updated_at::text from public.estimates limit 1");
    await db.query("update public.estimates set job_title = 'changed' where id = $1", [before.id]);
    const after = await one<{ updated_at: string }>("select updated_at::text from public.estimates where id = $1", [before.id]);
    expect(after.updated_at).not.toBe(before.updated_at);
  });
});
