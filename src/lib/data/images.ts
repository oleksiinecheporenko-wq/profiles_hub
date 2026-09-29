import "server-only";

import type { Repository } from "./repository";

/** Signed avatar URLs (1 hour) keyed by photo path; profiles without a photo are skipped. */
export async function profilePhotoUrls(
  repo: Repository,
  items: { photoPath: string | null }[],
): Promise<Record<string, string>> {
  const paths = items.map((i) => i.photoPath).filter((p): p is string => !!p);
  if (paths.length === 0) return {};
  try {
    return await repo.signedImageUrls("profile-photos", paths);
  } catch (error) {
    // A storage hiccup must not break the page: avatars fall back to initials.
    console.error("[images]", error);
    return {};
  }
}
