import "server-only";

// Supabase implementation of Repository. Uses the service role key, so it must only
// ever run on the server. Reads go through tables/views, every multi-row mutation
// through a Postgres function (supabase/migrations/…_functions.sql).

import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import type { DailyChangeInput } from "@/lib/domain/dailyChanges";
import type { ContractStatus, ProfileStatus } from "@/lib/domain/enums";
import { RepositoryError, type RepositoryErrorCode } from "@/lib/domain/errors";
import type { VersionPayload } from "@/lib/domain/versions";
import type {
  ActivityEntry,
  Contract,
  ContractComment,
  ContractDetail,
  ContractListItem,
  DailyChange,
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
import type {
  ActivityPage,
  ActivityQuery,
  ContractQuery,
  DeletedProfile,
  ImageUpload,
  ProfileDetail,
  Repository,
  StorageBucket,
} from "./repository";
import {
  activityFromRow,
  commentFromRow,
  contractFromRow,
  dailyChangeFromRow,
  languageFromRow,
  profileFromRow,
  profileOverviewFromRow,
  versionFromRow,
  type ActivityLogRow,
  type ContractCommentRow,
  type ContractRow,
  type DailyChangeRow,
  type ProfileLanguageRow,
  type ProfileOverviewRow,
  type ProfileRow,
  type ProfileVersionRow,
} from "./rows";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

const SQLSTATE_TO_CODE: Record<string, RepositoryErrorCode> = {
  UP404: "not_found",
  UP409: "conflict",
  UP410: "duplicate",
  UP422: "invalid",
  UP423: "not_current",
  "23505": "duplicate", // unique_violation
  "21000": "duplicate", // cardinality_violation (same key twice in one upsert)
  "23503": "not_found", // foreign_key_violation
  "23502": "invalid", // not_null_violation
  "23514": "invalid", // check_violation
  "22P02": "invalid", // invalid_text_representation (bad enum/uuid)
  "22003": "invalid", // numeric_value_out_of_range
  "22007": "invalid", // invalid_datetime_format
  "22008": "invalid", // datetime_field_overflow
  PGRST116: "not_found", // .single() found no row
};

function fail(error: PostgrestError | { message: string; code?: string }): never {
  const code = (error.code && SQLSTATE_TO_CODE[error.code]) || "unknown";
  if (code === "unknown") console.error("[supabase]", error);
  throw new RepositoryError(code, error.message);
}

function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) fail(result.error);
  if (result.data === null) throw new RepositoryError("not_found");
  return result.data;
}

type ContractWithProfileRow = ContractRow & {
  profile: Pick<ProfileRow, "id" | "full_name" | "photo_path" | "profile_url"> | null;
};

const CONTRACT_SELECT = "*, profile:profiles(id, full_name, photo_path, profile_url)";

function refFromRow(r: Pick<ProfileRow, "id" | "full_name" | "photo_path" | "profile_url">): ProfileRef {
  return { id: r.id, fullName: r.full_name, photoPath: r.photo_path, profileUrl: r.profile_url };
}

function contractListItemFromRow(r: ContractWithProfileRow): ContractListItem {
  return {
    ...contractFromRow(r),
    profile: r.profile
      ? refFromRow(r.profile)
      : { id: r.profile_id, fullName: "—", photoPath: null, profileUrl: null },
  };
}

function patchToRow(patch: ProfileFieldsPatch): Record<string, unknown> {
  const map: Record<keyof ProfileFieldsPatch, string> = {
    visibility: "visibility",
    experienceLevel: "experience_level",
    education: "education",
    categories: "categories",
    email: "email",
    billingMethod: "billing_method",
    timeZone: "time_zone",
    address: "address",
    phone: "phone",
    profileUrl: "profile_url",
    photoPath: "photo_path",
  };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) out[map[key as keyof ProfileFieldsPatch]] = value;
  }
  return out;
}

function dailyChangeToRpc(change: DailyChangeInput): Record<string, unknown> {
  if (!("op" in change)) return { value: change.value };
  switch (change.op) {
    case "add":
      return change.index === undefined
        ? { op: "add", item: change.item }
        : { op: "add", item: change.item, index: change.index };
    case "update":
      return { op: "update", item: change.item };
    case "remove":
      return { op: "remove", item_id: change.itemId };
    case "reorder":
      return { op: "reorder", ids: change.ids };
  }
}

function payloadToRpc(payload: VersionPayload) {
  return { update_date: payload.updateDate, content: payload.content };
}

/** Double-quoted PostgREST filter value (timestamps contain `:` and `+`). */
const quote = (value: string) => `"${value.replace(/"/g, '\\"')}"`;

export class SupabaseRepository implements Repository {
  readonly kind = "supabase" as const;
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  // ---- profiles -----------------------------------------------------------

  async listProfiles(): Promise<ProfileOverview[]> {
    const rows = unwrap(
      await this.db.from("profile_overview").select("*").order("last_activity_at", { ascending: false }),
    ) as ProfileOverviewRow[];
    return rows.map(profileOverviewFromRow);
  }

  async getProfile(id: Uuid): Promise<ProfileDetail | null> {
    const [overview, languages] = await Promise.all([
      this.db.from("profile_overview").select("*").eq("id", id).maybeSingle(),
      this.db.from("profile_languages").select("*").eq("profile_id", id).order("position"),
    ]);
    if (overview.error) fail(overview.error);
    if (languages.error) fail(languages.error);
    if (!overview.data) return null;
    return {
      profile: profileOverviewFromRow(overview.data as ProfileOverviewRow),
      languages: (languages.data as ProfileLanguageRow[]).map(languageFromRow),
    };
  }

  async createProfile(input: CreateProfileInput): Promise<Profile> {
    const row = unwrap(
      await this.db.rpc("create_profile", {
        p_full_name: input.fullName,
        p_status: input.status,
        p_title: input.title,
        p_profile_url: input.profileUrl,
        p_photo_path: input.photoPath,
      }),
    ) as ProfileRow;
    return profileFromRow(row);
  }

  async updateProfileFields(id: Uuid, patch: ProfileFieldsPatch): Promise<Profile> {
    const row = unwrap(
      await this.db.rpc("update_profile_fields", { p_profile_id: id, p_patch: patchToRow(patch) }),
    ) as ProfileRow;
    return profileFromRow(row);
  }

  async setProfileLanguages(id: Uuid, languages: LanguageInput[]): Promise<ProfileLanguage[]> {
    const rows = unwrap(
      await this.db.rpc("set_profile_languages", { p_profile_id: id, p_languages: languages }),
    ) as ProfileLanguageRow[];
    return rows.map(languageFromRow);
  }

  async changeProfileStatus(id: Uuid, status: ProfileStatus, reason: string | null): Promise<Profile> {
    const row = unwrap(
      await this.db.rpc("change_profile_status", {
        p_profile_id: id,
        p_new_status: status,
        p_reason: reason,
      }),
    ) as ProfileRow;
    return profileFromRow(row);
  }

  async deleteProfile(id: Uuid): Promise<DeletedProfile> {
    const data = unwrap(await this.db.rpc("delete_profile", { p_profile_id: id })) as {
      full_name: string;
      photo_path: string | null;
      portfolio_images: string[] | null;
    };
    return {
      fullName: data.full_name,
      photoPath: data.photo_path,
      portfolioImages: data.portfolio_images ?? [],
    };
  }

  // ---- versions -----------------------------------------------------------

  async listVersions(profileId: Uuid): Promise<VersionSummary[]> {
    const rows = unwrap(
      await this.db
        .from("profile_versions")
        .select("id, update_date, is_current, title, created_at, updated_at, daily_changes(count)")
        .eq("profile_id", profileId)
        .order("update_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ) as (Pick<ProfileVersionRow, "id" | "update_date" | "is_current" | "title" | "created_at" | "updated_at"> & {
      daily_changes: { count: number }[];
    })[];
    return rows.map((r) => ({
      id: r.id,
      updateDate: r.update_date,
      isCurrent: r.is_current,
      title: r.title,
      dailyChangeCount: r.daily_changes[0]?.count ?? 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async getVersion(versionId: Uuid): Promise<ProfileVersion | null> {
    const { data, error } = await this.db.from("profile_versions").select("*").eq("id", versionId).maybeSingle();
    if (error) fail(error);
    return data ? versionFromRow(data as ProfileVersionRow) : null;
  }

  async getCurrentVersion(profileId: Uuid): Promise<ProfileVersion | null> {
    const { data, error } = await this.db
      .from("profile_versions")
      .select("*")
      .eq("profile_id", profileId)
      .eq("is_current", true)
      .maybeSingle();
    if (error) fail(error);
    return data ? versionFromRow(data as ProfileVersionRow) : null;
  }

  async applyDailyChange(
    versionId: Uuid,
    change: DailyChangeInput,
    expectedUpdatedAt: Timestamp,
  ): Promise<ProfileVersion> {
    const row = unwrap(
      await this.db.rpc("apply_daily_change", {
        p_version_id: versionId,
        p_field: change.field,
        p_change: dailyChangeToRpc(change),
        p_expected_updated_at: expectedUpdatedAt,
      }),
    ) as ProfileVersionRow;
    return versionFromRow(row);
  }

  async createGlobalVersion(profileId: Uuid, payload: VersionPayload): Promise<ProfileVersion> {
    const row = unwrap(
      await this.db.rpc("create_global_version", {
        p_profile_id: profileId,
        p_payload: payloadToRpc(payload),
      }),
    ) as ProfileVersionRow;
    return versionFromRow(row);
  }

  async editGlobalVersion(
    versionId: Uuid,
    payload: VersionPayload,
    expectedUpdatedAt: Timestamp,
  ): Promise<ProfileVersion> {
    const row = unwrap(
      await this.db.rpc("edit_global_version", {
        p_version_id: versionId,
        p_payload: payloadToRpc(payload),
        p_expected_updated_at: expectedUpdatedAt,
      }),
    ) as ProfileVersionRow;
    return versionFromRow(row);
  }

  async listDailyChanges(versionId: Uuid): Promise<DailyChange[]> {
    const rows = unwrap(
      await this.db
        .from("daily_changes")
        .select("*")
        .eq("version_id", versionId)
        .order("changed_at", { ascending: false })
        .order("id", { ascending: false }),
    ) as DailyChangeRow[];
    return rows.map(dailyChangeFromRow);
  }

  async listSkillSuggestions(): Promise<string[]> {
    const rows = unwrap(await this.db.from("skill_catalog").select("name").order("name")) as { name: string }[];
    return rows.map((r) => r.name);
  }

  // ---- activity -----------------------------------------------------------

  async listActivity(query: ActivityQuery): Promise<ActivityPage> {
    let q = this.db.from("activity_feed").select("*");
    if (query.profileId) q = q.eq("profile_id", query.profileId);
    if (query.actions) q = q.in("action", query.actions);
    if (query.from) q = q.gte("occurred_at", query.from);
    if (query.to) q = q.lt("occurred_at", query.to);
    if (query.before) {
      const at = quote(query.before.occurredAt);
      q = q.or(`occurred_at.lt.${at},and(occurred_at.eq.${at},tx_id.lt.${query.before.txId})`);
    }
    const rows = unwrap(
      await q
        .order("occurred_at", { ascending: false })
        .order("tx_id", { ascending: false })
        .limit(query.limit + 1),
    ) as {
      tx_id: number | string;
      occurred_at: string;
      action: string;
      profile_id: string | null;
      rows: ActivityLogRow[];
    }[];

    const page = rows.slice(0, query.limit);
    const profileIds = [...new Set(page.map((r) => r.profile_id).filter((id): id is string => !!id))];
    const refs = new Map<string, ProfileRef>();
    if (profileIds.length > 0) {
      const profiles = unwrap(
        await this.db.from("profiles").select("id, full_name, photo_path, profile_url").in("id", profileIds),
      ) as Pick<ProfileRow, "id" | "full_name" | "photo_path" | "profile_url">[];
      for (const p of profiles) refs.set(p.id, refFromRow(p));
    }

    const entries: ActivityEntry[] = page.map((r) => ({
      txId: Number(r.tx_id),
      occurredAt: r.occurred_at,
      action: r.action,
      profileId: r.profile_id,
      profile: r.profile_id ? (refs.get(r.profile_id) ?? null) : null,
      rows: r.rows.map(activityFromRow),
    }));
    const last = entries[entries.length - 1];
    return {
      entries,
      nextCursor: rows.length > query.limit && last ? { occurredAt: last.occurredAt, txId: last.txId } : null,
    };
  }

  // ---- contracts ----------------------------------------------------------

  async listContracts(query: ContractQuery = {}): Promise<ContractListItem[]> {
    let q = this.db.from("contracts").select(CONTRACT_SELECT).is("deleted_at", null);
    if (query.profileId) q = q.eq("profile_id", query.profileId);
    const rows = unwrap(
      await q.order("created_date", { ascending: false }).order("created_at", { ascending: false }),
    ) as unknown as ContractWithProfileRow[];
    return rows.map(contractListItemFromRow);
  }

  async getContract(id: Uuid): Promise<ContractDetail | null> {
    const [contract, comments] = await Promise.all([
      this.db.from("contracts").select(CONTRACT_SELECT).eq("id", id).is("deleted_at", null).maybeSingle(),
      this.db.from("contract_comments").select("*").eq("contract_id", id).order("created_at"),
    ]);
    if (contract.error) fail(contract.error);
    if (comments.error) fail(comments.error);
    if (!contract.data) return null;
    return {
      ...contractListItemFromRow(contract.data as unknown as ContractWithProfileRow),
      comments: (comments.data as ContractCommentRow[]).map(commentFromRow),
    };
  }

  async createContract(input: ContractInput): Promise<Contract> {
    const row = unwrap(
      await this.db.rpc("create_contract", {
        p_profile_id: input.profileId,
        p_created_date: input.createdDate,
        p_title: input.title,
        p_rate: input.rate,
        p_description: input.description,
        p_dialog: input.dialog,
      }),
    ) as ContractRow;
    return contractFromRow(row);
  }

  async updateContract(id: Uuid, input: ContractInput, expectedUpdatedAt?: Timestamp): Promise<Contract> {
    const row = unwrap(
      await this.db.rpc("update_contract", {
        p_contract_id: id,
        p_profile_id: input.profileId,
        p_created_date: input.createdDate,
        p_title: input.title,
        p_rate: input.rate,
        p_description: input.description,
        p_dialog: input.dialog,
        p_expected_updated_at: expectedUpdatedAt ?? null,
      }),
    ) as ContractRow;
    return contractFromRow(row);
  }

  async setContractStatus(id: Uuid, status: ContractStatus): Promise<Contract> {
    const row = unwrap(
      await this.db.rpc("set_contract_status", { p_contract_id: id, p_status: status }),
    ) as ContractRow;
    return contractFromRow(row);
  }

  async softDeleteContract(id: Uuid): Promise<void> {
    const { error } = await this.db.rpc("soft_delete_contract", { p_contract_id: id });
    if (error) fail(error);
  }

  async addContractComment(contractId: Uuid, body: string): Promise<ContractComment> {
    const row = unwrap(
      await this.db.rpc("add_contract_comment", { p_contract_id: contractId, p_body: body }),
    ) as ContractCommentRow;
    return commentFromRow(row);
  }

  // ---- storage --------------------------------------------------------------

  async uploadImage(bucket: StorageBucket, upload: ImageUpload): Promise<string> {
    const ext = upload.contentType.split("/")[1].replace("jpeg", "jpg");
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await this.db.storage
      .from(bucket)
      .upload(path, upload.bytes, { contentType: upload.contentType, upsert: false });
    if (error) fail({ message: error.message });
    return path;
  }

  async removeImages(bucket: StorageBucket, paths: string[]): Promise<void> {
    const unique = [...new Set(paths.filter(Boolean))];
    if (unique.length === 0) return;
    const { error } = await this.db.storage.from(bucket).remove(unique);
    if (error) fail({ message: error.message });
  }

  async signedImageUrls(bucket: StorageBucket, paths: string[]): Promise<Record<string, string>> {
    const unique = [...new Set(paths.filter(Boolean))];
    if (unique.length === 0) return {};
    const { data, error } = await this.db.storage.from(bucket).createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
    if (error) fail({ message: error.message });
    const out: Record<string, string> = {};
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) out[item.path] = item.signedUrl;
    }
    return out;
  }
}
