"use server";

import { failure, ok, type ActionResult } from "@/lib/actions/result";
import { getRepository } from "@/lib/data";
import { loadFeed, parseFeedFilters, type FeedPage } from "@/lib/data/activityFeed";
import type { ActivityCursor } from "@/lib/data/repository";

/** `Показати ще`: the next page for the same filters (given as URL params). */
export async function loadMoreActivityAction(
  params: Record<string, string>,
  cursor: ActivityCursor,
): Promise<ActionResult<FeedPage>> {
  if (typeof cursor?.occurredAt !== "string" || typeof cursor?.txId !== "number") {
    return { ok: false, error: "Некоректний курсор.", code: "invalid" };
  }
  try {
    const repo = await getRepository();
    return ok(await loadFeed(repo, parseFeedFilters(params), cursor));
  } catch (error) {
    return failure(error);
  }
}
