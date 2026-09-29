// Global version rules (Part A, sections 5 and 7).

import { COLLECTION_FIELDS, type PlainDate, type ProfileVersion, type VersionContent } from "./types";

export type VersionPayload = {
  updateDate: PlainDate;
  content: VersionContent;
};

export function emptyVersionContent(title: string | null = null): VersionContent {
  return {
    title,
    rate: null,
    description: null,
    skills: [],
    portfolio: [],
    project_catalog: [],
    certifications: [],
    employment_history: [],
    other_experiences: [],
    additional_info: null,
  };
}

/**
 * Pre-fills the `+ Нове оновлення` form from the current version.
 * Collection items keep their ids, so comparison can match them across versions.
 */
export function draftFromVersion(current: ProfileVersion, today: PlainDate): VersionPayload {
  const content = structuredClone(current.content);
  return { updateDate: today, content };
}

/** Rail order: `update_date desc, created_at desc`. */
export function compareVersionsForRail(
  a: Pick<ProfileVersion, "updateDate" | "createdAt">,
  b: Pick<ProfileVersion, "updateDate" | "createdAt">,
): number {
  if (a.updateDate !== b.updateDate) return a.updateDate < b.updateDate ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return 0;
}

/** All collection item ids of a version content, for sanity checks. */
export function collectionItemIds(content: VersionContent): string[] {
  return COLLECTION_FIELDS.flatMap((field) => content[field].map((item) => item.id));
}
