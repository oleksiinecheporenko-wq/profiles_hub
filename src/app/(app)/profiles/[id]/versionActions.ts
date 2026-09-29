"use server";

import { revalidatePath } from "next/cache";
import { failure, invalid, ok, type ActionResult } from "@/lib/actions/result";
import { getRepository } from "@/lib/data";
import type { Timestamp } from "@/lib/domain/types";
import { readImage } from "@/lib/upload";
import { uuid } from "@/lib/validation/common";
import { versionPayloadSchema } from "@/lib/validation/version";

function revalidateProfile(profileId: string) {
  revalidatePath(`/profiles/${profileId}`);
  revalidatePath("/profiles");
  revalidatePath("/status-profiles");
  revalidatePath("/actions");
}

export async function createGlobalVersionAction(
  profileId: string,
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const id = uuid.safeParse(profileId);
  if (!id.success) return invalid(id.error);
  const parsed = versionPayloadSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const repo = await getRepository();
    const version = await repo.createGlobalVersion(id.data, parsed.data);
    revalidateProfile(id.data);
    return ok({ id: version.id });
  } catch (error) {
    return failure(error);
  }
}

/** Edits any version, current or archived; recorded in `Дії` as version.edited. */
export async function editGlobalVersionAction(
  target: { profileId: string; versionId: string; expectedUpdatedAt: Timestamp },
  payload: unknown,
): Promise<ActionResult<{ id: string }>> {
  const profileId = uuid.safeParse(target.profileId);
  const versionId = uuid.safeParse(target.versionId);
  if (!profileId.success) return invalid(profileId.error);
  if (!versionId.success) return invalid(versionId.error);
  const parsed = versionPayloadSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const repo = await getRepository();
    const existing = await repo.getVersion(versionId.data);
    if (!existing || existing.profileId !== profileId.data) {
      return { ok: false, error: "Версію не знайдено.", code: "not_found" };
    }
    const version = await repo.editGlobalVersion(versionId.data, parsed.data, target.expectedUpdatedAt);
    revalidateProfile(profileId.data);
    return ok({ id: version.id });
  } catch (error) {
    return failure(error);
  }
}

/** Stores a portfolio image; the path is saved with the version later. */
export async function uploadPortfolioImageAction(form: FormData): Promise<ActionResult<{ path: string; url: string | null }>> {
  const file = form.get("image");
  if (!(file instanceof File)) return { ok: false, error: "Оберіть файл.", code: "invalid" };
  const image = await readImage(file);
  if (!image.ok) return { ok: false, error: image.error, code: "invalid" };
  try {
    const repo = await getRepository();
    const path = await repo.uploadImage("portfolio-images", image.upload);
    const urls = await repo.signedImageUrls("portfolio-images", [path]);
    return ok({ path, url: urls[path] ?? null });
  } catch (error) {
    return failure(error);
  }
}
