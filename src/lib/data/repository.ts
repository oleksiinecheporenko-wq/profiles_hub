// Data access contract. Pages and server actions depend on this interface only;
// `SupabaseRepository` and `MockRepository` implement it. Inputs are validated with
// the zod schemas in `src/lib/validation/estimate.ts` before they get here.

import type {
  Estimate,
  EstimateFile,
  EstimateRow,
  EstimateStatus,
  EstimateWithFiles,
  NextStep,
  Uuid,
} from "@/lib/domain/estimate";
import type { CreateEstimateInput, EstimateInfoPatch, FileMeta } from "@/lib/validation/estimate";

export const MATERIALS_BUCKET = "estimate-materials";

export type EstimateQuery = {
  status: EstimateStatus;
  /** Search over client, project, job title and developer. */
  q?: string;
};

/** Where the browser sends a file: a signed URL, or null to upload through the server. */
export type UploadTarget = { path: string; signedUrl: string | null };

export interface Repository {
  readonly kind: "supabase" | "mock";

  /** Newest first (archive: by archive date). */
  listEstimates(query: EstimateQuery): Promise<Estimate[]>;
  countByStatus(): Promise<Record<EstimateStatus, number>>;
  getEstimate(id: Uuid): Promise<EstimateWithFiles | null>;
  createEstimate(input: CreateEstimateInput): Promise<Estimate>;
  /** Text fields; allowed while the estimate is in progress or ready. */
  updateInfo(id: Uuid, patch: EstimateInfoPatch): Promise<Estimate>;
  /** Table rows; only while in progress. */
  updateRows(id: Uuid, rows: EstimateRow[]): Promise<Estimate>;
  /** in_progress → ready, stamps ready_at. */
  markReady(id: Uuid): Promise<Estimate>;
  /** ready → in_progress, clears ready_at. */
  reopen(id: Uuid): Promise<Estimate>;
  /** Only while ready. */
  setRate(id: Uuid, rate: number | null): Promise<Estimate>;
  /** Only while ready; null restores the standard steps. */
  setNextSteps(id: Uuid, steps: NextStep[] | null): Promise<Estimate>;
  /** ready (with a rate) → archived. */
  archive(id: Uuid): Promise<Estimate>;
  /** Permanent; returns the storage paths of its files for cleanup. */
  deleteEstimate(id: Uuid): Promise<string[]>;

  // Materials
  createUploadTarget(estimateId: Uuid, fileName: string): Promise<UploadTarget>;
  /** Server-side upload (mock mode, small files). */
  uploadFile(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  addFile(estimateId: Uuid, meta: FileMeta): Promise<EstimateFile>;
  /** Returns the removed file's storage path. */
  removeFile(fileId: Uuid): Promise<string>;
  removeObjects(paths: string[]): Promise<void>;
  /** Signed download URLs (1 hour) keyed by path. */
  signedUrls(paths: string[]): Promise<Record<string, string>>;
}

/** Storage path for a new file: `<estimate>/<random>-<safe name>`. */
export function materialPath(estimateId: Uuid, fileName: string): string {
  const safe =
    fileName
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-80) || "file";
  return `${estimateId}/${crypto.randomUUID()}-${safe}`;
}
