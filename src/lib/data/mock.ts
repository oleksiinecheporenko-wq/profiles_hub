// In-memory Repository for local work without Supabase. Takes its clock and id
// generator as options, so the sample data set (sample.ts) is produced by running
// real operations against it.

import {
  defaultRows,
  type Estimate,
  type EstimateFile,
  type EstimateRow,
  type EstimateStatus,
  type EstimateWithFiles,
  type Timestamp,
  type Uuid,
} from "@/lib/domain/estimate";
import { RepositoryError } from "@/lib/domain/errors";
import type { CreateEstimateInput, EstimateInfoPatch, FileMeta } from "@/lib/validation/estimate";
import { materialPath, type EstimateQuery, type Repository, type UploadTarget } from "./repository";

export type MockState = {
  estimates: Estimate[];
  files: EstimateFile[];
  /** path → data URL */
  objects: Record<string, string>;
};

export type MockOptions = {
  now: () => Timestamp;
  newId: () => Uuid;
};

export function emptyMockState(): MockState {
  return { estimates: [], files: [], objects: {} };
}

/** Monotonic wall clock: two writes never share a timestamp. */
export function monotonicClock(): () => Timestamp {
  let last = 0;
  return () => {
    last = Math.max(Date.now(), last + 1);
    return new Date(last).toISOString();
  };
}

const clone = <T,>(v: T): T => structuredClone(v);

export function matchesSearch(e: Estimate, q: string | undefined): boolean {
  const needle = q?.trim().toLocaleLowerCase("uk");
  if (!needle) return true;
  return [e.clientName, e.projectName, e.jobTitle, e.developer]
    .filter((v): v is string => !!v)
    .some((v) => v.toLocaleLowerCase("uk").includes(needle));
}

export class MockRepository implements Repository {
  readonly kind = "mock" as const;
  state: MockState;
  private readonly opts: MockOptions;

  constructor(state: MockState, opts: MockOptions) {
    this.state = state;
    this.opts = opts;
  }

  private find(id: Uuid): Estimate {
    const e = this.state.estimates.find((x) => x.id === id);
    if (!e) throw new RepositoryError("not_found");
    return e;
  }

  private write(id: Uuid, allowed: EstimateStatus[], change: (e: Estimate, now: Timestamp) => Partial<Estimate>): Estimate {
    const e = this.find(id);
    if (!allowed.includes(e.status)) throw new RepositoryError("wrong_status");
    const now = this.opts.now();
    const next = { ...e, ...change(e, now), updatedAt: now };
    this.state.estimates = this.state.estimates.map((x) => (x.id === id ? next : x));
    return clone(next);
  }

  async listEstimates(query: EstimateQuery): Promise<Estimate[]> {
    const key = (e: Estimate) => (query.status === "archived" ? (e.archivedAt ?? e.createdAt) : e.createdAt);
    return clone(
      this.state.estimates
        .filter((e) => e.status === query.status && matchesSearch(e, query.q))
        .sort((a, b) => (key(a) < key(b) ? 1 : -1)),
    );
  }

  async countByStatus(): Promise<Record<EstimateStatus, number>> {
    const out = { in_progress: 0, ready: 0, archived: 0 };
    for (const e of this.state.estimates) out[e.status]++;
    return out;
  }

  async getEstimate(id: Uuid): Promise<EstimateWithFiles | null> {
    const e = this.state.estimates.find((x) => x.id === id);
    if (!e) return null;
    return clone({
      ...e,
      files: this.state.files.filter((f) => f.estimateId === id).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    });
  }

  async createEstimate(input: CreateEstimateInput): Promise<Estimate> {
    const now = this.opts.now();
    const estimate: Estimate = {
      id: this.opts.newId(),
      clientName: input.clientName.trim(),
      projectName: input.projectName,
      status: "in_progress",
      developer: null,
      rate: null,
      jobTitle: null,
      jobDescription: null,
      additionalInfo: null,
      links: [],
      rows: defaultRows(this.opts.newId),
      createdAt: now,
      readyAt: null,
      archivedAt: null,
      updatedAt: now,
    };
    this.state.estimates.push(estimate);
    return clone(estimate);
  }

  async updateInfo(id: Uuid, patch: EstimateInfoPatch): Promise<Estimate> {
    return this.write(id, ["in_progress", "ready"], () => {
      const out: Partial<Estimate> = {};
      for (const [k, v] of Object.entries(patch)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
      return out;
    });
  }

  async updateRows(id: Uuid, rows: EstimateRow[]): Promise<Estimate> {
    return this.write(id, ["in_progress"], () => ({ rows: clone(rows) }));
  }

  async markReady(id: Uuid): Promise<Estimate> {
    return this.write(id, ["in_progress"], (_e, now) => ({ status: "ready", readyAt: now }));
  }

  async reopen(id: Uuid): Promise<Estimate> {
    return this.write(id, ["ready"], () => ({ status: "in_progress", readyAt: null }));
  }

  async setRate(id: Uuid, rate: number | null): Promise<Estimate> {
    return this.write(id, ["ready"], () => ({ rate }));
  }

  async archive(id: Uuid): Promise<Estimate> {
    const e = this.find(id);
    if (e.status === "ready" && e.rate === null) throw new RepositoryError("invalid", "rate required");
    return this.write(id, ["ready"], (_e, now) => ({ status: "archived", archivedAt: now }));
  }

  async deleteEstimate(id: Uuid): Promise<string[]> {
    this.find(id);
    const paths = this.state.files.filter((f) => f.estimateId === id).map((f) => f.path);
    this.state.estimates = this.state.estimates.filter((e) => e.id !== id);
    this.state.files = this.state.files.filter((f) => f.estimateId !== id);
    return paths;
  }

  async createUploadTarget(estimateId: Uuid, fileName: string): Promise<UploadTarget> {
    this.find(estimateId);
    return { path: materialPath(estimateId, fileName), signedUrl: null };
  }

  async uploadFile(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.state.objects[path] = `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
  }

  async addFile(estimateId: Uuid, meta: FileMeta): Promise<EstimateFile> {
    this.find(estimateId);
    const file: EstimateFile = {
      id: this.opts.newId(),
      estimateId,
      path: meta.path,
      name: meta.name,
      mimeType: meta.mimeType,
      size: meta.size,
      createdAt: this.opts.now(),
    };
    this.state.files.push(file);
    return clone(file);
  }

  async removeFile(fileId: Uuid): Promise<string> {
    const file = this.state.files.find((f) => f.id === fileId);
    if (!file) throw new RepositoryError("not_found");
    this.state.files = this.state.files.filter((f) => f.id !== fileId);
    return file.path;
  }

  async removeObjects(paths: string[]): Promise<void> {
    for (const p of paths) delete this.state.objects[p];
  }

  async signedUrls(paths: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const p of paths) if (this.state.objects[p]) out[p] = this.state.objects[p];
    return out;
  }
}
