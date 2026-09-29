"use server";

import { revalidatePath } from "next/cache";
import { failure, invalid, ok, type ActionResult } from "@/lib/actions/result";
import { getRepository } from "@/lib/data";
import { readImage } from "@/lib/upload";
import { createProfileSchema } from "@/lib/validation/profile";

const text = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : undefined;
};

export async function createProfileAction(form: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = createProfileSchema.safeParse({
    fullName: text(form, "fullName"),
    status: text(form, "status") || undefined,
    title: text(form, "title"),
    profileUrl: text(form, "profileUrl"),
    photoPath: null,
  });
  if (!parsed.success) return invalid(parsed.error);

  try {
    const repo = await getRepository();
    let photoPath: string | null = null;
    const photo = form.get("photo");
    if (photo instanceof File && photo.size > 0) {
      const image = await readImage(photo);
      if (!image.ok) {
        return { ok: false, error: image.error, code: "invalid", fieldErrors: { photo: image.error } };
      }
      photoPath = await repo.uploadImage("profile-photos", image.upload);
    }

    const profile = await repo.createProfile({ ...parsed.data, photoPath });
    revalidatePath("/profiles");
    revalidatePath("/status-profiles");
    return ok({ id: profile.id });
  } catch (error) {
    return failure(error);
  }
}
