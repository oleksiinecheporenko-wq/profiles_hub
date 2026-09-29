import "server-only";

import { connection } from "next/server";
import { monotonicClock, MockRepository } from "./mock";
import type { Repository } from "./repository";
import { buildSampleDataset } from "./sample";
import { SupabaseRepository } from "./supabase";

export type { Repository } from "./repository";

// Survives module reloads in dev, so mock edits last for the whole server session.
const globalCache = globalThis as unknown as {
  __upmRepository?: Promise<Repository>;
};

async function createRepository(): Promise<Repository> {
  const url = process.env.SUPABASE_URL;
  if (url) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required when SUPABASE_URL is set.");
    return new SupabaseRepository(url, key);
  }
  let tx = 0;
  return new MockRepository(await buildSampleDataset(), {
    now: monotonicClock(),
    newId: () => crypto.randomUUID(),
    nextTxId: () => ++tx,
  });
}

/** The data source: Supabase when `SUPABASE_URL` is set, otherwise the in-memory mock. */
export function getRepository(): Promise<Repository> {
  globalCache.__upmRepository ??= createRepository();
  return globalCache.__upmRepository;
}

/**
 * For Server Components: marks the render as request-time (no prerendering at build)
 * before touching the data source.
 */
export async function getRequestRepository(): Promise<Repository> {
  await connection();
  return getRepository();
}
