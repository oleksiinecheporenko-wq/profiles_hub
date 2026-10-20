import "server-only";

// Supabase implementation of Repository. Uses the service role key, so it must only
// ever run on the server. Status changes are conditional updates (`where status in
// (...)`), so a stale page can never move an estimate out of the wrong section.

import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import {
  defaultRows,
  type Estimate,
  type EstimateFile,
  type EstimateRow,
  type EstimateStatus,
  type EstimateWithFiles,
  type Uuid,
} from "@/lib/domain/estimate";
import { RepositoryError, type RepositoryErrorCode } from "@/lib/domain/errors";
import type { CreateEstimateInput, EstimateInfoPatch, FileMeta } from "@/lib/validation/estimate";
import { MATERIALS_BUCKET, materialPath, type EstimateQuery, type Repository, type UploadTarget } from "./repository";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

const SQLSTATE_TO_CODE: Record<string, RepositoryErrorCode> = {
  "23503": "not_found",
  "23502": "invalid",
  "23514": "invalid",
  "22P02": "invalid",
  "22003": "invalid",
  PGRST116: "not_found",
};

function fail(error: PostgrestError | { message: string; code?: string }): never {
  const code = (error.code && SQLSTATE_TO_CODE[error.code]) || "unknown";
  if (code === "unknown") console.error("[supabase]", error);
  throw new RepositoryError(code, error.message);
}

type EstimateDbRow = {
  id: string;
  client_name: string;
  project_name: string | null;
  status: EstimateStatus;
  developer: string | null;
  rate: number | string | null;
  job_title: string | null;
  job_description: string | null;
  additional_info: string | null;
  links: Estimate["links"] | null;
  rows: EstimateRow[] | null;
  created_at: string;
  ready_at: string | null;
  archived_at: string | null;
  updated_at: string;
};

type FileDbRow = {
  id: string;
  estimate_id: string;
  path: string;
  name: string;
  mime_type: string | null;
  size: number | string | null;
  created_at: string;
};

const num = (v: number | string | null) => (v === null ? null : Number(v));

function estimateFromRow(r: EstimateDbRow): Estimate {
  return {
    id: r.id,
    clientName: r.client_name,
    projectName: r.project_name,
    status: r.status,
    developer: r.developer,
    rate: num(r.rate),
    jobTitle: r.job_title,
    jobDescription: r.job_description,
    additionalInfo: r.additional_info,
    links: r.links ?? [],
    rows: (r.rows ?? []).map((row) => ({ ...row, realistic: row.realistic === null ? null : Number(row.realistic) })),
    createdAt: r.created_at,
    readyAt: r.ready_at,
    archivedAt: r.archived_at,
    updatedAt: r.updated_at,
  };
}

function fileFromRow(r: FileDbRow): EstimateFile {
  return {
    id: r.id,
    estimateId: r.estimate_id,
    path: r.path,
    name: r.name,
    mimeType: r.mime_type,
    size: num(r.size),
    createdAt: r.created_at,
  };
}

const PATCH_COLUMNS: Record<keyof EstimateInfoPatch, string> = {
  clientName: "client_name",
  projectName: "project_name",
  jobTitle: "job_title",
  jobDescription: "job_description",
  additionalInfo: "additional_info",
  developer: "developer",
  links: "links",
};

/** Characters with meaning in PostgREST filter syntax are dropped from search text. */
const safeSearch = (q: string) => q.replace(/[,()*%\\"'.:]/g, " ").trim().slice(0, 100);

export class SupabaseRepository implements Repository {
  readonly kind = "supabase" as const;
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  /** Conditional update: only applies while the estimate is in one of `allowed`. */
  private async transition(id: Uuid, allowed: EstimateStatus[], values: Record<string, unknown>): Promise<Estimate> {
    const { data, error } = await this.db
      .from("estimates")
      .update(values)
      .eq("id", id)
      .in("status", allowed)
      .select("*")
      .maybeSingle();
    if (error) fail(error);
    if (data) return estimateFromRow(data as EstimateDbRow);
    const exists = await this.db.from("estimates").select("id").eq("id", id).maybeSingle();
    throw new RepositoryError(exists.data ? "wrong_status" : "not_found");
  }

  async listEstimates(query: EstimateQuery): Promise<Estimate[]> {
    let q = this.db.from("estimates").select("*").eq("status", query.status);
    const text = query.q ? safeSearch(query.q) : "";
    if (text) {
      const like = `%${text}%`;
      q = q.or(["client_name", "project_name", "job_title", "developer"].map((c) => `${c}.ilike.${like}`).join(","));
    }
    const order = query.status === "archived" ? "archived_at" : "created_at";
    const { data, error } = await q.order(order, { ascending: false });
    if (error) fail(error);
    return (data as EstimateDbRow[]).map(estimateFromRow);
  }

  async countByStatus(): Promise<Record<EstimateStatus, number>> {
    const out = { in_progress: 0, ready: 0, archived: 0 };
    const results = await Promise.all(
      (Object.keys(out) as EstimateStatus[]).map(async (status) => {
        const { count, error } = await this.db.from("estimates").select("id", { count: "exact", head: true }).eq("status", status);
        if (error) fail(error);
        return [status, count ?? 0] as const;
      }),
    );
    for (const [status, count] of results) out[status] = count;
    return out;
  }

  async getEstimate(id: Uuid): Promise<EstimateWithFiles | null> {
    const [estimate, files] = await Promise.all([
      this.db.from("estimates").select("*").eq("id", id).maybeSingle(),
      this.db.from("estimate_files").select("*").eq("estimate_id", id).order("created_at"),
    ]);
    if (estimate.error) fail(estimate.error);
    if (files.error) fail(files.error);
    if (!estimate.data) return null;
    return { ...estimateFromRow(estimate.data as EstimateDbRow), files: (files.data as FileDbRow[]).map(fileFromRow) };
  }

  async createEstimate(input: CreateEstimateInput): Promise<Estimate> {
    const { data, error } = await this.db
      .from("estimates")
      .insert({
        client_name: input.clientName,
        project_name: input.projectName,
        rows: defaultRows(() => crypto.randomUUID()),
      })
      .select("*")
      .single();
    if (error) fail(error);
    return estimateFromRow(data as EstimateDbRow);
  }

  async updateInfo(id: Uuid, patch: EstimateInfoPatch): Promise<Estimate> {
    const values: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) values[PATCH_COLUMNS[k as keyof EstimateInfoPatch]] = v;
    }
    return this.transition(id, ["in_progress", "ready"], values);
  }

  async updateRows(id: Uuid, rows: EstimateRow[]): Promise<Estimate> {
    return this.transition(id, ["in_progress"], { rows });
  }

  async markReady(id: Uuid): Promise<Estimate> {
    return this.transition(id, ["in_progress"], { status: "ready", ready_at: new Date().toISOString() });
  }

  async reopen(id: Uuid): Promise<Estimate> {
    return this.transition(id, ["ready"], { status: "in_progress", ready_at: null });
  }

  async setRate(id: Uuid, rate: number | null): Promise<Estimate> {
    return this.transition(id, ["ready"], { rate });
  }

  async archive(id: Uuid): Promise<Estimate> {
    // The table's check constraint also refuses an archive without a rate.
    return this.transition(id, ["ready"], { status: "archived", archived_at: new Date().toISOString() });
  }

  async deleteEstimate(id: Uuid): Promise<string[]> {
    const files = await this.db.from("estimate_files").select("path").eq("estimate_id", id);
    if (files.error) fail(files.error);
    const { data, error } = await this.db.from("estimates").delete().eq("id", id).select("id");
    if (error) fail(error);
    if (!data || data.length === 0) throw new RepositoryError("not_found");
    return (files.data as { path: string }[]).map((f) => f.path);
  }

  async createUploadTarget(estimateId: Uuid, fileName: string): Promise<UploadTarget> {
    const path = materialPath(estimateId, fileName);
    const { data, error } = await this.db.storage.from(MATERIALS_BUCKET).createSignedUploadUrl(path);
    if (error) fail({ message: error.message });
    return { path, signedUrl: data.signedUrl };
  }

  async uploadFile(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const { error } = await this.db.storage.from(MATERIALS_BUCKET).upload(path, bytes, { contentType, upsert: false });
    if (error) fail({ message: error.message });
  }

  async addFile(estimateId: Uuid, meta: FileMeta): Promise<EstimateFile> {
    const { data, error } = await this.db
      .from("estimate_files")
      .insert({ estimate_id: estimateId, path: meta.path, name: meta.name, mime_type: meta.mimeType, size: meta.size })
      .select("*")
      .single();
    if (error) fail(error);
    return fileFromRow(data as FileDbRow);
  }

  async removeFile(fileId: Uuid): Promise<string> {
    const { data, error } = await this.db.from("estimate_files").delete().eq("id", fileId).select("path").maybeSingle();
    if (error) fail(error);
    if (!data) throw new RepositoryError("not_found");
    return (data as { path: string }).path;
  }

  async removeObjects(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await this.db.storage.from(MATERIALS_BUCKET).remove(paths);
    if (error) fail({ message: error.message });
  }

  async signedUrls(paths: string[]): Promise<Record<string, string>> {
    const unique = [...new Set(paths)];
    if (unique.length === 0) return {};
    const { data, error } = await this.db.storage.from(MATERIALS_BUCKET).createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
    if (error) fail({ message: error.message });
    const out: Record<string, string> = {};
    for (const item of data ?? []) if (item.path && item.signedUrl && !item.error) out[item.path] = item.signedUrl;
    return out;
  }
}
