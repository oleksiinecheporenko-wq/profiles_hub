"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, ok, type ActionResult } from "@/lib/actions/result";
import { getRepository } from "@/lib/data";
import type { Estimate, EstimateFile } from "@/lib/domain/estimate";
import { hasEstimatedTasks } from "@/lib/domain/estimate";
import {
  createEstimateSchema,
  estimateInfoPatchSchema,
  fileMetaSchema,
  rateSchema,
  rowsSchema,
  uuid,
} from "@/lib/validation/estimate";

/** Small server-side uploads (mock mode, or a fallback) stay under Vercel's body limit. */
const SERVER_UPLOAD_LIMIT = 4 * 1024 * 1024;
const MAX_FILE = 50 * 1024 * 1024;

function revalidate(id?: string) {
  revalidatePath("/requests");
  revalidatePath("/ready");
  revalidatePath("/archive");
  if (id) revalidatePath(`/estimates/${id}`);
}

const fail = (error: string, code = "invalid"): ActionResult<never> => ({ ok: false, error, code });

export async function createEstimateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createEstimateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const estimate = await (await getRepository()).createEstimate(parsed.data);
    revalidate();
    return ok({ id: estimate.id });
  } catch (error) {
    return failure(error);
  }
}

export async function updateInfoAction(id: string, patch: unknown): Promise<ActionResult<Estimate>> {
  const eid = uuid.safeParse(id);
  if (!eid.success) return invalid(eid.error);
  const parsed = estimateInfoPatchSchema.safeParse(patch);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const estimate = await (await getRepository()).updateInfo(eid.data, parsed.data);
    revalidate(eid.data);
    return ok(estimate);
  } catch (error) {
    return failure(error);
  }
}

export async function saveRowsAction(id: string, rows: unknown): Promise<ActionResult<{ updatedAt: string }>> {
  const eid = uuid.safeParse(id);
  if (!eid.success) return invalid(eid.error);
  const parsed = rowsSchema.safeParse(rows);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const estimate = await (await getRepository()).updateRows(eid.data, parsed.data);
    revalidate(eid.data);
    return ok({ updatedAt: estimate.updatedAt });
  } catch (error) {
    return failure(error);
  }
}

/** `Готово`: needs a developer and at least one named task with hours. */
export async function markReadyAction(id: string): Promise<ActionResult> {
  const eid = uuid.safeParse(id);
  if (!eid.success) return invalid(eid.error);
  try {
    const repo = await getRepository();
    const estimate = await repo.getEstimate(eid.data);
    if (!estimate) return fail("Запит не знайдено.", "not_found");
    if (!estimate.developer?.trim()) return fail("Вкажіть розробника.");
    if (!hasEstimatedTasks(estimate.rows)) return fail("Додайте хоча б одну фічу з годинами Realistic.");
    await repo.markReady(eid.data);
    revalidate(eid.data);
    return ok(undefined);
  } catch (error) {
    return failure(error);
  }
}

export async function reopenAction(id: string): Promise<ActionResult> {
  const eid = uuid.safeParse(id);
  if (!eid.success) return invalid(eid.error);
  try {
    await (await getRepository()).reopen(eid.data);
    revalidate(eid.data);
    return ok(undefined);
  } catch (error) {
    return failure(error);
  }
}

export async function setRateAction(id: string, rate: number | null): Promise<ActionResult> {
  const eid = uuid.safeParse(id);
  if (!eid.success) return invalid(eid.error);
  const parsed = rateSchema.nullable().safeParse(rate);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await (await getRepository()).setRate(eid.data, parsed.data);
    revalidate(eid.data);
    return ok(undefined);
  } catch (error) {
    return failure(error);
  }
}

/** `Зберегти`: final save with the rate; the estimate moves to `Архів`. */
export async function archiveAction(id: string, rate: number): Promise<ActionResult> {
  const eid = uuid.safeParse(id);
  if (!eid.success) return invalid(eid.error);
  const parsed = rateSchema.safeParse(rate);
  if (!parsed.success) return fail("Вкажіть рейт перед збереженням.");
  try {
    const repo = await getRepository();
    await repo.setRate(eid.data, parsed.data);
    await repo.archive(eid.data);
    revalidate(eid.data);
    return ok(undefined);
  } catch (error) {
    return failure(error);
  }
}

export async function deleteEstimateAction(id: string): Promise<ActionResult> {
  const eid = uuid.safeParse(id);
  if (!eid.success) return invalid(eid.error);
  try {
    const repo = await getRepository();
    const paths = await repo.deleteEstimate(eid.data);
    try {
      await repo.removeObjects(paths);
    } catch (error) {
      console.error("[deleteEstimate] storage cleanup failed", error);
    }
    revalidate();
    return ok(undefined);
  } catch (error) {
    return failure(error);
  }
}

// ---- materials ----------------------------------------------------------------

const prepareSchema = z.object({
  name: z.string().min(1).max(300),
  size: z.number().int().min(0).max(MAX_FILE, { message: "Файл більший за 50 МБ." }),
});

/** Where to upload a file: a signed URL (browser → storage directly) or the server. */
export async function prepareUploadAction(
  id: string,
  file: { name: string; size: number },
): Promise<ActionResult<{ path: string; signedUrl: string | null }>> {
  const eid = uuid.safeParse(id);
  if (!eid.success) return invalid(eid.error);
  const parsed = prepareSchema.safeParse(file);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const target = await (await getRepository()).createUploadTarget(eid.data, parsed.data.name);
    if (!target.signedUrl && parsed.data.size > SERVER_UPLOAD_LIMIT) {
      return fail("Без Supabase можна завантажити файл до 4 МБ.");
    }
    return ok(target);
  } catch (error) {
    return failure(error);
  }
}

/** Server-side upload for when there is no signed URL (mock mode). */
export async function uploadThroughServerAction(form: FormData): Promise<ActionResult> {
  const file = form.get("file");
  const path = form.get("path");
  if (!(file instanceof File) || typeof path !== "string") return fail("Оберіть файл.");
  // Only paths minted by `materialPath`: `<estimate uuid>/<uuid>-<safe name>`.
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}-[A-Za-z0-9._-]+$/.test(path)) return fail("Некоректний шлях файлу.");
  if (file.size > SERVER_UPLOAD_LIMIT) return fail("Файл завеликий для завантаження через сервер.");
  try {
    await (await getRepository()).uploadFile(path, new Uint8Array(await file.arrayBuffer()), file.type || "application/octet-stream");
    return ok(undefined);
  } catch (error) {
    return failure(error);
  }
}

/** Records an uploaded file and returns it with a signed URL for display. */
export async function registerFileAction(
  id: string,
  meta: unknown,
): Promise<ActionResult<{ file: EstimateFile; url: string | null }>> {
  const eid = uuid.safeParse(id);
  if (!eid.success) return invalid(eid.error);
  const parsed = fileMetaSchema.safeParse(meta);
  if (!parsed.success) return invalid(parsed.error);
  if (!parsed.data.path.startsWith(`${eid.data}/`)) return fail("Некоректний шлях файлу.");
  try {
    const repo = await getRepository();
    const file = await repo.addFile(eid.data, parsed.data);
    const urls = await repo.signedUrls([file.path]);
    revalidate(eid.data);
    return ok({ file, url: urls[file.path] ?? null });
  } catch (error) {
    return failure(error);
  }
}

export async function removeFileAction(estimateId: string, fileId: string): Promise<ActionResult> {
  const eid = uuid.safeParse(estimateId);
  const fid = uuid.safeParse(fileId);
  if (!eid.success) return invalid(eid.error);
  if (!fid.success) return invalid(fid.error);
  try {
    const repo = await getRepository();
    const path = await repo.removeFile(fid.data);
    try {
      await repo.removeObjects([path]);
    } catch (error) {
      console.error("[removeFile] storage cleanup failed", error);
    }
    revalidate(eid.data);
    return ok(undefined);
  } catch (error) {
    return failure(error);
  }
}
