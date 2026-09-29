"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, ok, type ActionResult } from "@/lib/actions/result";
import { getRepository } from "@/lib/data";
import type { ProfileLanguage, Timestamp } from "@/lib/domain/types";
import { readImage } from "@/lib/upload";
import { uuid } from "@/lib/validation/common";
import {
  languagesSchema,
  profileFieldsPatchSchema,
  statusChangeSchema,
} from "@/lib/validation/profile";
import { dailyChangeSchema } from "@/lib/validation/version";

function revalidateProfile(profileId: string) {
  revalidatePath(`/profiles/${profileId}`);
  revalidatePath("/profiles");
  revalidatePath("/status-profiles");
  revalidatePath("/actions");
}

export async function changeStatusAction(
  profileId: string,
  input: { status: string; reason: string | null },
): Promise<ActionResult> {
  const id = uuid.safeParse(profileId);
  if (!id.success) return invalid(id.error);
  const parsed = statusChangeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const repo = await getRepository();
    await repo.changeProfileStatus(id.data, parsed.data.status, parsed.data.reason);
    revalidateProfile(id.data);
    return ok(undefined);
  } catch (error) {
    return failure(error);
  }
}

/** Account fields of `Основна інформація`; no daily changes. */
export async function updateProfileFieldsAction(
  profileId: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  const id = uuid.safeParse(profileId);
  if (!id.success) return invalid(id.error);
  const parsed = profileFieldsPatchSchema.safeParse(patch);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const repo = await getRepository();
    await repo.updateProfileFields(id.data, parsed.data);
    revalidateProfile(id.data);
    return ok(undefined);
  } catch (error) {
    return failure(error);
  }
}

export async function setLanguagesAction(
  profileId: string,
  languages: unknown,
): Promise<ActionResult<ProfileLanguage[]>> {
  const id = uuid.safeParse(profileId);
  if (!id.success) return invalid(id.error);
  const parsed = languagesSchema.safeParse(languages);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const repo = await getRepository();
    const saved = await repo.setProfileLanguages(id.data, parsed.data);
    revalidateProfile(id.data);
    return ok(saved);
  } catch (error) {
    return failure(error);
  }
}

const contentFieldSchema = z.object({
  profileId: uuid,
  versionId: uuid,
  expectedUpdatedAt: z.string().min(1),
});

/**
 * Title, Rate and Description from `Основна інформація`: a daily change on the
 * current version. Returns the version's new `updated_at` for the next edit.
 */
export async function updateContentFieldAction(
  target: { profileId: string; versionId: string; expectedUpdatedAt: Timestamp },
  change: unknown,
): Promise<ActionResult<{ updatedAt: Timestamp }>> {
  const t = contentFieldSchema.safeParse(target);
  if (!t.success) return invalid(t.error);
  const parsed = dailyChangeSchema.safeParse(change);
  if (!parsed.success) return invalid(parsed.error);
  if (!["title", "rate", "description"].includes(parsed.data.field)) {
    return { ok: false, error: "Це поле тут не редагується.", code: "invalid" };
  }
  try {
    const repo = await getRepository();
    const version = await repo.getVersion(t.data.versionId);
    if (!version || version.profileId !== t.data.profileId) {
      return { ok: false, error: "Версію не знайдено.", code: "not_found" };
    }
    const updated = await repo.applyDailyChange(t.data.versionId, parsed.data, t.data.expectedUpdatedAt);
    revalidateProfile(t.data.profileId);
    return ok({ updatedAt: updated.updatedAt });
  } catch (error) {
    return failure(error);
  }
}

export async function uploadProfilePhotoAction(profileId: string, form: FormData): Promise<ActionResult> {
  const id = uuid.safeParse(profileId);
  if (!id.success) return invalid(id.error);
  const photo = form.get("photo");
  if (!(photo instanceof File)) return { ok: false, error: "Оберіть файл.", code: "invalid" };
  const image = await readImage(photo);
  if (!image.ok) return { ok: false, error: image.error, code: "invalid" };
  try {
    const repo = await getRepository();
    const path = await repo.uploadImage("profile-photos", image.upload);
    await repo.updateProfileFields(id.data, { photoPath: path });
    revalidateProfile(id.data);
    return ok(undefined);
  } catch (error) {
    return failure(error);
  }
}

/**
 * Permanent deletion. The typed name must match the profile's full name (checked
 * here too, not only in the dialog). Stored images are removed afterwards; a storage
 * failure does not undo the deletion.
 */
export async function deleteProfileAction(profileId: string, confirmName: string): Promise<ActionResult<{ fullName: string }>> {
  const id = uuid.safeParse(profileId);
  if (!id.success) return invalid(id.error);
  try {
    const repo = await getRepository();
    const detail = await repo.getProfile(id.data);
    if (!detail) return { ok: false, error: "Профіль не знайдено.", code: "not_found" };
    if (confirmName.trim() !== detail.profile.fullName.trim()) {
      return { ok: false, error: "ПІБ не збігається.", code: "invalid", fieldErrors: { confirm: "ПІБ не збігається." } };
    }

    const deleted = await repo.deleteProfile(id.data);
    try {
      if (deleted.photoPath) await repo.removeImages("profile-photos", [deleted.photoPath]);
      if (deleted.portfolioImages.length) await repo.removeImages("portfolio-images", deleted.portfolioImages);
    } catch (error) {
      console.error("[deleteProfile] storage cleanup failed", error);
    }

    revalidateProfile(id.data);
    revalidatePath("/contracts");
    return ok({ fullName: deleted.fullName });
  } catch (error) {
    return failure(error);
  }
}
