import "server-only";

/** Supabase is the source of truth when configured; otherwise the in-memory mock repository is used. */
export function isMockMode(): boolean {
  return !process.env.SUPABASE_URL;
}
