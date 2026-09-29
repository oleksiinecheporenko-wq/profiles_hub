import "server-only";

import {
  ACTION_GROUP_KEYS,
  ACTION_GROUPS,
  actionGroup,
  entryChanges,
  hasExpandableChanges,
  summarizeEntry,
  type ActionGroup,
  type ChangeLine,
} from "@/lib/domain/activity";
import type { ProfileRef } from "@/lib/domain/types";
import { addDays, kyivDayStart, todayPlainDate } from "@/lib/format";
import { profilePhotoUrls } from "./images";
import type { ActivityCursor, Repository } from "./repository";

export const FEED_PAGE_SIZE = 50;
const SCAN_PAGE = 100;
const MAX_SCAN_PAGES = 20;

export type FeedPeriod = "today" | "7d" | "30d" | "custom";

export type FeedFilters = {
  profileId?: string;
  group?: ActionGroup;
  period?: FeedPeriod;
  /** `yyyy-MM-dd`, custom period only. */
  from?: string;
  to?: string;
  q?: string;
};

export type FeedEntry = {
  txId: number;
  occurredAt: string;
  action: string;
  group: ActionGroup | null;
  profile: ProfileRef | null;
  photoUrl: string | null;
  summary: string;
  changes: ChangeLine[];
  expandable: boolean;
};

export type FeedPage = { entries: FeedEntry[]; nextCursor: ActivityCursor | null };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Filters from URL search params; anything invalid is dropped. */
export function parseFeedFilters(sp: Record<string, string | string[] | undefined>): FeedFilters {
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const period = str("period");
  const group = str("group");
  const profile = str("profile");
  return {
    profileId: profile && UUID.test(profile) ? profile : undefined,
    group: ACTION_GROUP_KEYS.includes(group as ActionGroup) ? (group as ActionGroup) : undefined,
    period: period === "today" || period === "7d" || period === "30d" || period === "custom" ? period : undefined,
    from: str("from") && DATE.test(str("from")!) ? str("from") : undefined,
    to: str("to") && DATE.test(str("to")!) ? str("to") : undefined,
    q: str("q")?.trim().slice(0, 200) || undefined,
  };
}

function range(filters: FeedFilters): { from?: string; to?: string } {
  const today = todayPlainDate();
  switch (filters.period) {
    case "today":
      return { from: kyivDayStart(today).toISOString() };
    case "7d":
      return { from: kyivDayStart(addDays(today, -6)).toISOString() };
    case "30d":
      return { from: kyivDayStart(addDays(today, -29)).toISOString() };
    case "custom":
      return {
        from: filters.from ? kyivDayStart(filters.from).toISOString() : undefined,
        to: filters.to ? kyivDayStart(addDays(filters.to, 1)).toISOString() : undefined,
      };
    default:
      return {};
  }
}

/**
 * One page of the feed. Text search runs over the rendered summaries, so pages are
 * scanned until enough matches are found (bounded; the cursor lets the user continue).
 */
export async function loadFeed(
  repo: Repository,
  filters: FeedFilters,
  before?: ActivityCursor,
): Promise<FeedPage> {
  const { from, to } = range(filters);
  const actions = filters.group ? [...ACTION_GROUPS[filters.group].actions] : undefined;
  const q = filters.q?.toLocaleLowerCase("uk");

  const collected: FeedEntry[] = [];
  let cursor = before;
  let hasMore = false;

  scan: for (let page = 0; page < MAX_SCAN_PAGES; page++) {
    const result = await repo.listActivity({
      profileId: filters.profileId,
      actions,
      from,
      to,
      before: cursor,
      limit: q ? SCAN_PAGE : FEED_PAGE_SIZE - collected.length,
    });
    for (let i = 0; i < result.entries.length; i++) {
      const e = result.entries[i];
      cursor = { occurredAt: e.occurredAt, txId: e.txId };
      const summary = summarizeEntry(e);
      if (q && !summary.toLocaleLowerCase("uk").includes(q)) continue;
      collected.push({
        txId: e.txId,
        occurredAt: e.occurredAt,
        action: e.action,
        group: actionGroup(e.action),
        profile: e.profile,
        photoUrl: null,
        summary,
        changes: entryChanges(e),
        expandable: hasExpandableChanges(e),
      });
      if (collected.length >= FEED_PAGE_SIZE) {
        hasMore = i < result.entries.length - 1 || result.nextCursor !== null;
        break scan;
      }
    }
    if (!result.nextCursor) {
      hasMore = false;
      break;
    }
    // More pages exist; if the scan budget runs out here, the cursor continues it.
    hasMore = true;
  }

  const photos = await profilePhotoUrls(
    repo,
    collected.map((e) => ({ photoPath: e.profile?.photoPath ?? null })),
  );
  for (const e of collected) e.photoUrl = e.profile?.photoPath ? (photos[e.profile.photoPath] ?? null) : null;

  return { entries: collected, nextCursor: hasMore ? (cursor ?? null) : null };
}
