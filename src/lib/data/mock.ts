// In-memory Repository for local UI work without Supabase. Emulates the Postgres
// functions and log triggers: every mutation runs as one "transaction" with a single
// timestamp and tx id, is rolled back on error, and writes the same activity rows.
//
// The store takes its clock and id generators as options, so the sample data set
// (sample.ts) is produced by running real operations against it.

import { applyDailyChange, type DailyChangeInput } from "@/lib/domain/dailyChanges";
import type { ContractStatus, ProfileStatus } from "@/lib/domain/enums";
import { RepositoryError } from "@/lib/domain/errors";
import { compareVersionsForRail, emptyVersionContent, type VersionPayload } from "@/lib/domain/versions";
import type {
  ActivityEntry,
  ActivityRow,
  Contract,
  ContractComment,
  ContractDetail,
  ContractListItem,
  DailyChange,
  EntityType,
  Profile,
  ProfileLanguage,
  ProfileOverview,
  ProfileRef,
  ProfileVersion,
  Timestamp,
  Uuid,
  VersionSummary,
} from "@/lib/domain/types";
import type { ContractInput } from "@/lib/validation/contract";
import type { CreateProfileInput, LanguageInput, ProfileFieldsPatch } from "@/lib/validation/profile";
import { buildLogDetails, type LogOperation } from "./activityLog";
import type {
  ActivityPage,
  ActivityQuery,
  ContractQuery,
  ImageUpload,
  ProfileDetail,
  Repository,
  StorageBucket,
} from "./repository";
import {
  commentToRow,
  contractToRow,
  languageToRow,
  profileToRow,
  versionToRow,
} from "./rows";

export type MockState = {
  profiles: Profile[];
  languages: ProfileLanguage[];
  versions: ProfileVersion[];
  dailyChanges: DailyChange[];
  contracts: (Contract & { deletedAt: Timestamp | null })[];
  comments: ContractComment[];
  activity: ActivityRow[];
  images: Record<string, string>;
};

export type MockOptions = {
  /** Timestamp of the next transaction (ISO). */
  now: () => Timestamp;
  newId: () => Uuid;
  nextTxId: () => number;
};

export function emptyMockState(): MockState {
  return {
    profiles: [],
    languages: [],
    versions: [],
    dailyChanges: [],
    contracts: [],
    comments: [],
    activity: [],
    images: {},
  };
}

/** Monotonic wall clock: two transactions never share a timestamp. */
export function monotonicClock(): () => Timestamp {
  let last = 0;
  return () => {
    last = Math.max(Date.now(), last + 1);
    return new Date(last).toISOString();
  };
}

type Tx = {
  ts: Timestamp;
  txId: number;
  action: string | null;
  reason: string | null;
};

const clone = <T,>(v: T): T => structuredClone(v);

function todayKyiv(ts: Timestamp): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date(ts));
}

export class MockRepository implements Repository {
  readonly kind = "mock" as const;
  state: MockState;
  private readonly opts: MockOptions;

  constructor(state: MockState, opts: MockOptions) {
    this.state = state;
    this.opts = opts;
  }

  // ---- transaction & log emulation ----------------------------------------

  private transact<T>(action: string, fn: (tx: Tx) => T, reason: string | null = null): T {
    const backup = clone(this.state);
    const tx: Tx = { ts: this.opts.now(), txId: this.opts.nextTxId(), action, reason };
    try {
      return clone(fn(tx));
    } catch (error) {
      this.state = backup;
      throw error;
    }
  }

  private log(
    tx: Tx,
    entityType: EntityType,
    op: LogOperation,
    oldRow: Record<string, unknown> | null,
    newRow: Record<string, unknown> | null,
  ) {
    const details = buildLogDetails(op, oldRow, newRow, tx.reason);
    if (!details) return;
    const row = (newRow ?? oldRow)!;
    const profileId =
      entityType === "profile"
        ? (row.id as string)
        : entityType === "contract_comment"
          ? (this.state.contracts.find((c) => c.id === row.contract_id)?.profileId ?? null)
          : ((row.profile_id as string | undefined) ?? null);
    this.state.activity.push({
      id: this.opts.newId(),
      occurredAt: tx.ts,
      txId: tx.txId,
      profileId,
      entityType,
      entityId: (row.id as string) ?? null,
      action: tx.action ?? `${entityType}.${op.toLowerCase()}`,
      details,
    });
  }

  // ---- lookups --------------------------------------------------------------

  private profileOrThrow(id: Uuid): Profile {
    const p = this.state.profiles.find((x) => x.id === id);
    if (!p) throw new RepositoryError("not_found", `profile ${id}`);
    return p;
  }

  private versionOrThrow(id: Uuid): ProfileVersion {
    const v = this.state.versions.find((x) => x.id === id);
    if (!v) throw new RepositoryError("not_found", `version ${id}`);
    return v;
  }

  private liveContractOrThrow(id: Uuid) {
    const c = this.state.contracts.find((x) => x.id === id && x.deletedAt === null);
    if (!c) throw new RepositoryError("not_found", `contract ${id}`);
    return c;
  }

  private profileRef(id: Uuid): ProfileRef | null {
    const p = this.state.profiles.find((x) => x.id === id);
    return p ? { id: p.id, fullName: p.fullName, photoPath: p.photoPath, profileUrl: p.profileUrl } : null;
  }

  private overview(p: Profile): ProfileOverview {
    const current = this.state.versions.find((v) => v.profileId === p.id && v.isCurrent) ?? null;
    const lastDaily = this.state.dailyChanges
      .filter((d) => d.profileId === p.id)
      .reduce<string | null>((max, d) => (max === null || d.changedAt > max ? d.changedAt : max), null);
    const stamps = [p.updatedAt, p.statusChangedAt, current?.updatedAt, lastDaily].filter(
      (s): s is string => !!s,
    );
    return {
      ...p,
      currentVersionId: current?.id ?? null,
      title: current?.content.title ?? null,
      activeContractsCount: this.state.contracts.filter(
        (c) => c.profileId === p.id && c.status === "active" && c.deletedAt === null,
      ).length,
      lastActivityAt: stamps.reduce((a, b) => (b > a ? b : a)),
    };
  }

  private updateVersionRow(tx: Tx, before: ProfileVersion, after: ProfileVersion): ProfileVersion {
    const next = { ...after, updatedAt: tx.ts };
    const i = this.state.versions.findIndex((v) => v.id === before.id);
    this.state.versions[i] = next;
    this.log(tx, "version", "UPDATE", versionToRow(before), versionToRow(next));
    return next;
  }

  // ---- profiles -----------------------------------------------------------

  async listProfiles(): Promise<ProfileOverview[]> {
    return clone(
      this.state.profiles
        .map((p) => this.overview(p))
        .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1)),
    );
  }

  async getProfile(id: Uuid): Promise<ProfileDetail | null> {
    const p = this.state.profiles.find((x) => x.id === id);
    if (!p) return null;
    return clone({
      profile: this.overview(p),
      languages: this.state.languages
        .filter((l) => l.profileId === id)
        .sort((a, b) => a.position - b.position),
    });
  }

  async createProfile(input: CreateProfileInput): Promise<Profile> {
    return this.transact("profile.created", (tx) => {
      const profile: Profile = {
        id: this.opts.newId(),
        fullName: input.fullName.trim(),
        photoPath: input.photoPath ?? null,
        profileUrl: input.profileUrl ?? null,
        status: input.status ?? "active",
        statusChangedAt: tx.ts,
        visibility: null,
        experienceLevel: null,
        billingMethod: null,
        education: null,
        categories: [],
        email: null,
        timeZone: null,
        address: null,
        phone: null,
        createdAt: tx.ts,
        updatedAt: tx.ts,
      };
      this.state.profiles.push(profile);
      this.log(tx, "profile", "INSERT", null, profileToRow(profile));

      const version: ProfileVersion = {
        id: this.opts.newId(),
        profileId: profile.id,
        updateDate: todayKyiv(tx.ts),
        isCurrent: true,
        content: emptyVersionContent(input.title?.trim() || null),
        createdAt: tx.ts,
        updatedAt: tx.ts,
      };
      this.state.versions.push(version);
      this.log(tx, "version", "INSERT", null, versionToRow(version));
      return profile;
    });
  }

  async updateProfileFields(id: Uuid, patch: ProfileFieldsPatch): Promise<Profile> {
    return this.transact("profile.updated", (tx) => {
      const before = this.profileOrThrow(id);
      const next: Profile = { ...before };
      for (const [key, value] of Object.entries(patch)) {
        (next as Record<string, unknown>)[key] = value === undefined ? null : value;
      }
      const beforeRow = profileToRow(before);
      const changed = buildLogDetails("UPDATE", beforeRow, profileToRow(next));
      if (changed) next.updatedAt = tx.ts;
      this.state.profiles[this.state.profiles.indexOf(before)] = next;
      this.log(tx, "profile", "UPDATE", beforeRow, profileToRow(next));
      return next;
    });
  }

  async setProfileLanguages(id: Uuid, languages: LanguageInput[]): Promise<ProfileLanguage[]> {
    return this.transact("profile.languages_updated", (tx) => {
      this.profileOrThrow(id);
      if (new Set(languages.map((l) => l.language)).size !== languages.length) {
        throw new RepositoryError("duplicate", "duplicate language");
      }
      const wanted = new Map<string, LanguageInput & { position: number }>(
        languages.map((l, position) => [l.language, { ...l, position }]),
      );
      const existing = this.state.languages.filter((l) => l.profileId === id);

      for (const row of existing) {
        if (!wanted.has(row.language)) {
          this.state.languages = this.state.languages.filter((l) => l.id !== row.id);
          this.log(tx, "profile_language", "DELETE", languageToRow(row), null);
        }
      }
      for (const [language, w] of wanted) {
        const row = existing.find((l) => l.language === language);
        if (!row) {
          const created: ProfileLanguage = {
            id: this.opts.newId(),
            profileId: id,
            language,
            level: w.level,
            position: w.position,
          };
          this.state.languages.push(created);
          this.log(tx, "profile_language", "INSERT", null, languageToRow(created));
        } else if (row.level !== w.level || row.position !== w.position) {
          const updated = { ...row, level: w.level, position: w.position };
          this.state.languages = this.state.languages.map((l) => (l.id === row.id ? updated : l));
          this.log(tx, "profile_language", "UPDATE", languageToRow(row), languageToRow(updated));
        }
      }
      return this.state.languages
        .filter((l) => l.profileId === id)
        .sort((a, b) => a.position - b.position);
    });
  }

  async changeProfileStatus(id: Uuid, status: ProfileStatus, reason: string | null): Promise<Profile> {
    const current = this.profileOrThrow(id);
    if (current.status === status) return clone(current);
    return this.transact(
      "profile.status_changed",
      (tx) => {
        const before = this.profileOrThrow(id);
        const next: Profile = { ...before, status, statusChangedAt: tx.ts, updatedAt: tx.ts };
        this.state.profiles[this.state.profiles.indexOf(before)] = next;
        this.log(tx, "profile", "UPDATE", profileToRow(before), profileToRow(next));
        return next;
      },
      reason?.trim() || null,
    );
  }

  // ---- versions -----------------------------------------------------------

  async listVersions(profileId: Uuid): Promise<VersionSummary[]> {
    return this.state.versions
      .filter((v) => v.profileId === profileId)
      .sort(compareVersionsForRail)
      .map((v) => ({
        id: v.id,
        updateDate: v.updateDate,
        isCurrent: v.isCurrent,
        title: v.content.title,
        dailyChangeCount: this.state.dailyChanges.filter((d) => d.versionId === v.id).length,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }));
  }

  async getVersion(versionId: Uuid): Promise<ProfileVersion | null> {
    const v = this.state.versions.find((x) => x.id === versionId);
    return v ? clone(v) : null;
  }

  async getCurrentVersion(profileId: Uuid): Promise<ProfileVersion | null> {
    const v = this.state.versions.find((x) => x.profileId === profileId && x.isCurrent);
    return v ? clone(v) : null;
  }

  async applyDailyChange(
    versionId: Uuid,
    change: DailyChangeInput,
    expectedUpdatedAt: Timestamp,
  ): Promise<ProfileVersion> {
    return this.transact("version.daily_change", (tx) => {
      const before = this.versionOrThrow(versionId);
      if (!before.isCurrent) throw new RepositoryError("not_current");
      if (before.updatedAt !== expectedUpdatedAt) throw new RepositoryError("conflict");

      const result = applyDailyChange(before.content, change);
      if (!result) return before;

      const next = this.updateVersionRow(tx, before, { ...before, content: result.content });
      for (const record of result.records) {
        this.state.dailyChanges.push({
          id: this.opts.newId(),
          versionId: next.id,
          profileId: next.profileId,
          ...clone(record),
          changedAt: tx.ts,
        });
      }
      return next;
    });
  }

  async createGlobalVersion(profileId: Uuid, payload: VersionPayload): Promise<ProfileVersion> {
    return this.transact("version.created", (tx) => {
      this.profileOrThrow(profileId);
      const current = this.state.versions.find((v) => v.profileId === profileId && v.isCurrent);
      if (current) this.updateVersionRow(tx, current, { ...current, isCurrent: false });

      const version: ProfileVersion = {
        id: this.opts.newId(),
        profileId,
        updateDate: payload.updateDate || todayKyiv(tx.ts),
        isCurrent: true,
        content: clone(payload.content),
        createdAt: tx.ts,
        updatedAt: tx.ts,
      };
      this.state.versions.push(version);
      this.log(tx, "version", "INSERT", null, versionToRow(version));
      return version;
    });
  }

  async editGlobalVersion(
    versionId: Uuid,
    payload: VersionPayload,
    expectedUpdatedAt: Timestamp,
  ): Promise<ProfileVersion> {
    return this.transact("version.edited", (tx) => {
      const before = this.versionOrThrow(versionId);
      if (before.updatedAt !== expectedUpdatedAt) throw new RepositoryError("conflict");
      const candidate = { ...before, updateDate: payload.updateDate, content: clone(payload.content) };
      if (!buildLogDetails("UPDATE", versionToRow(before), versionToRow(candidate))) return before;
      return this.updateVersionRow(tx, before, candidate);
    });
  }

  async listDailyChanges(versionId: Uuid): Promise<DailyChange[]> {
    return clone(
      this.state.dailyChanges
        .filter((d) => d.versionId === versionId)
        .sort((a, b) => (a.changedAt === b.changedAt ? 0 : a.changedAt < b.changedAt ? 1 : -1)),
    );
  }

  // ---- activity -----------------------------------------------------------

  async listActivity(query: ActivityQuery): Promise<ActivityPage> {
    const groups = new Map<number, ActivityRow[]>();
    for (const row of this.state.activity) {
      const list = groups.get(row.txId) ?? [];
      list.push(row);
      groups.set(row.txId, list);
    }
    let entries: ActivityEntry[] = [...groups.entries()].map(([txId, rows]) => {
      const sorted = [...rows].sort((a, b) =>
        a.occurredAt === b.occurredAt ? a.id.localeCompare(b.id) : a.occurredAt < b.occurredAt ? -1 : 1,
      );
      const profileId = sorted.find((r) => r.profileId)?.profileId ?? null;
      return {
        txId,
        occurredAt: sorted[0].occurredAt,
        action: sorted[0].action,
        profileId,
        profile: profileId ? this.profileRef(profileId) : null,
        rows: sorted,
      };
    });

    entries = entries.filter((e) => {
      if (query.profileId && e.profileId !== query.profileId) return false;
      if (query.actions && !query.actions.includes(e.action)) return false;
      if (query.from && e.occurredAt < query.from) return false;
      if (query.to && e.occurredAt >= query.to) return false;
      if (query.before) {
        const b = query.before;
        if (e.occurredAt > b.occurredAt) return false;
        if (e.occurredAt === b.occurredAt && e.txId >= b.txId) return false;
      }
      return true;
    });

    entries.sort((a, b) =>
      a.occurredAt === b.occurredAt ? b.txId - a.txId : a.occurredAt < b.occurredAt ? 1 : -1,
    );

    const page = entries.slice(0, query.limit);
    const last = page[page.length - 1];
    return clone({
      entries: page,
      nextCursor:
        entries.length > query.limit && last ? { occurredAt: last.occurredAt, txId: last.txId } : null,
    });
  }

  // ---- contracts ----------------------------------------------------------

  private listItem(c: Contract & { deletedAt: Timestamp | null }): ContractListItem {
    const { deletedAt: _deletedAt, ...contract } = c;
    void _deletedAt;
    const profile = this.profileRef(c.profileId) ?? {
      id: c.profileId,
      fullName: "—",
      photoPath: null,
      profileUrl: null,
    };
    return { ...contract, profile };
  }

  async listContracts(query: ContractQuery = {}): Promise<ContractListItem[]> {
    return clone(
      this.state.contracts
        .filter((c) => c.deletedAt === null && (!query.profileId || c.profileId === query.profileId))
        .sort((a, b) =>
          a.createdDate !== b.createdDate
            ? a.createdDate < b.createdDate
              ? 1
              : -1
            : a.createdAt < b.createdAt
              ? 1
              : -1,
        )
        .map((c) => this.listItem(c)),
    );
  }

  async getContract(id: Uuid): Promise<ContractDetail | null> {
    const c = this.state.contracts.find((x) => x.id === id && x.deletedAt === null);
    if (!c) return null;
    return clone({
      ...this.listItem(c),
      comments: this.state.comments
        .filter((m) => m.contractId === id)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    });
  }

  async createContract(input: ContractInput): Promise<Contract> {
    return stripProfile(this.transact("contract.created", (tx) => {
      this.profileOrThrow(input.profileId);
      const contract = {
        id: this.opts.newId(),
        profileId: input.profileId,
        createdDate: input.createdDate || todayKyiv(tx.ts),
        title: input.title.trim(),
        rate: input.rate,
        description: input.description,
        dialog: input.dialog,
        status: "active" as const,
        closedAt: null,
        createdAt: tx.ts,
        updatedAt: tx.ts,
        deletedAt: null,
      };
      this.state.contracts.push(contract);
      this.log(tx, "contract", "INSERT", null, contractToRow(contract, null));
      return this.listItem(contract);
    }));
  }

  async updateContract(id: Uuid, input: ContractInput, expectedUpdatedAt?: Timestamp): Promise<Contract> {
    return stripProfile(this.transact("contract.edited", (tx) => {
      const before = this.liveContractOrThrow(id);
      if (expectedUpdatedAt && before.updatedAt !== expectedUpdatedAt) {
        throw new RepositoryError("conflict");
      }
      this.profileOrThrow(input.profileId);
      const next = {
        ...before,
        profileId: input.profileId,
        createdDate: input.createdDate,
        title: input.title.trim(),
        rate: input.rate,
        description: input.description,
        dialog: input.dialog,
      };
      const details = buildLogDetails("UPDATE", contractToRow(before, null), contractToRow(next, null));
      if (details) next.updatedAt = tx.ts;
      this.state.contracts[this.state.contracts.indexOf(before)] = next;
      this.log(tx, "contract", "UPDATE", contractToRow(before, null), contractToRow(next, null));
      return this.listItem(next);
    }));
  }

  async setContractStatus(id: Uuid, status: ContractStatus): Promise<Contract> {
    const current = this.liveContractOrThrow(id);
    if (current.status === status) return stripProfile(clone(this.listItem(current)));
    return stripProfile(this.transact(status === "closed" ? "contract.closed" : "contract.reopened", (tx) => {
      const before = this.liveContractOrThrow(id);
      const next = {
        ...before,
        status,
        closedAt: status === "closed" ? tx.ts : null,
        updatedAt: tx.ts,
      };
      this.state.contracts[this.state.contracts.indexOf(before)] = next;
      this.log(tx, "contract", "UPDATE", contractToRow(before, null), contractToRow(next, null));
      return this.listItem(next);
    }));
  }

  async softDeleteContract(id: Uuid): Promise<void> {
    this.transact("contract.deleted", (tx) => {
      const before = this.liveContractOrThrow(id);
      const next = { ...before, deletedAt: tx.ts, updatedAt: tx.ts };
      this.state.contracts[this.state.contracts.indexOf(before)] = next;
      this.log(tx, "contract", "UPDATE", contractToRow(before, null), contractToRow(next, tx.ts));
    });
  }

  async addContractComment(contractId: Uuid, body: string): Promise<ContractComment> {
    return this.transact("contract.comment_added", (tx) => {
      this.liveContractOrThrow(contractId);
      if (!body.trim()) throw new RepositoryError("invalid", "empty comment");
      const comment: ContractComment = { id: this.opts.newId(), contractId, body, createdAt: tx.ts };
      this.state.comments.push(comment);
      this.log(tx, "contract_comment", "INSERT", null, commentToRow(comment));
      return comment;
    });
  }

  // ---- storage --------------------------------------------------------------

  async uploadImage(bucket: StorageBucket, upload: ImageUpload): Promise<string> {
    const ext = upload.contentType.split("/")[1].replace("jpeg", "jpg");
    const path = `${crypto.randomUUID()}.${ext}`;
    const base64 = Buffer.from(upload.bytes).toString("base64");
    this.state.images[`${bucket}/${path}`] = `data:${upload.contentType};base64,${base64}`;
    return path;
  }

  async signedImageUrls(bucket: StorageBucket, paths: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const path of paths) {
      const url = this.state.images[`${bucket}/${path}`];
      if (url) out[path] = url;
    }
    return out;
  }
}

function stripProfile(item: ContractListItem): Contract {
  const { profile: _profile, ...contract } = item;
  void _profile;
  return contract;
}
