// Data access contract. Components and server actions depend on this interface only;
// `supabaseRepository` and `mockRepository` implement it.
//
// Inputs are expected to be validated with the zod schemas in `src/lib/validation`.
// Failures are thrown as `RepositoryError` (see `src/lib/domain/errors.ts`).

import type { ContractStatus, ProfileStatus } from "@/lib/domain/enums";
import type { DailyChangeInput } from "@/lib/domain/dailyChanges";
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
  ProfileVersion,
  Timestamp,
  Uuid,
  VersionSummary,
} from "@/lib/domain/types";
import type { ContractInput } from "@/lib/validation/contract";
import type { CreateProfileInput, LanguageInput, ProfileFieldsPatch } from "@/lib/validation/profile";

export type ProfileDetail = {
  profile: ProfileOverview;
  languages: ProfileLanguage[];
};

export type ActivityCursor = { occurredAt: Timestamp; txId: number };

export type ActivityQuery = {
  profileId?: Uuid;
  /** Only entries whose action is one of these. */
  actions?: string[];
  /** Inclusive lower bound. */
  from?: Timestamp;
  /** Exclusive upper bound. */
  to?: Timestamp;
  /** Entries strictly older than this cursor. */
  before?: ActivityCursor;
  limit: number;
};

export type ActivityPage = {
  entries: ActivityEntry[];
  nextCursor: ActivityCursor | null;
};

/** What a permanent deletion left in storage, for the caller to clean up. */
export type DeletedProfile = {
  fullName: string;
  photoPath: string | null;
  portfolioImages: string[];
};

export type ContractQuery = {
  profileId?: Uuid;
};

export type StorageBucket = "profile-photos" | "portfolio-images";

export type ImageUpload = {
  bytes: Uint8Array;
  contentType: "image/jpeg" | "image/png" | "image/webp";
};

export interface Repository {
  readonly kind: "supabase" | "mock";

  // Profiles
  listProfiles(): Promise<ProfileOverview[]>;
  getProfile(id: Uuid): Promise<ProfileDetail | null>;
  createProfile(input: CreateProfileInput): Promise<Profile>;
  updateProfileFields(id: Uuid, patch: ProfileFieldsPatch): Promise<Profile>;
  setProfileLanguages(id: Uuid, languages: LanguageInput[]): Promise<ProfileLanguage[]>;
  /** No-op (returns the profile unchanged) when the status is the same. */
  changeProfileStatus(id: Uuid, status: ProfileStatus, reason: string | null): Promise<Profile>;
  /** Permanent: also removes versions, daily changes, languages, contracts, comments. */
  deleteProfile(id: Uuid): Promise<DeletedProfile>;

  // Versions
  /** Rail order: `update_date desc, created_at desc`. */
  listVersions(profileId: Uuid): Promise<VersionSummary[]>;
  getVersion(versionId: Uuid): Promise<ProfileVersion | null>;
  getCurrentVersion(profileId: Uuid): Promise<ProfileVersion | null>;
  /** Only for the current version; throws `conflict` if `expectedUpdatedAt` is stale. */
  applyDailyChange(
    versionId: Uuid,
    change: DailyChangeInput,
    expectedUpdatedAt: Timestamp,
  ): Promise<ProfileVersion>;
  createGlobalVersion(profileId: Uuid, payload: VersionPayload): Promise<ProfileVersion>;
  editGlobalVersion(
    versionId: Uuid,
    payload: VersionPayload,
    expectedUpdatedAt: Timestamp,
  ): Promise<ProfileVersion>;
  /** Newest first. */
  listDailyChanges(versionId: Uuid): Promise<DailyChange[]>;
  /** Every skill ever saved in any version (autocomplete), alphabetical. */
  listSkillSuggestions(): Promise<string[]>;

  // Activity
  listActivity(query: ActivityQuery): Promise<ActivityPage>;

  // Contracts (soft-deleted contracts are never returned)
  listContracts(query?: ContractQuery): Promise<ContractListItem[]>;
  getContract(id: Uuid): Promise<ContractDetail | null>;
  createContract(input: ContractInput): Promise<Contract>;
  updateContract(id: Uuid, input: ContractInput, expectedUpdatedAt?: Timestamp): Promise<Contract>;
  setContractStatus(id: Uuid, status: ContractStatus): Promise<Contract>;
  softDeleteContract(id: Uuid): Promise<void>;
  addContractComment(contractId: Uuid, body: string): Promise<ContractComment>;

  // Storage
  /** Stores the image under a random name and returns its path in the bucket. */
  uploadImage(bucket: StorageBucket, upload: ImageUpload): Promise<string>;
  /** Removes stored files; missing paths are ignored. */
  removeImages(bucket: StorageBucket, paths: string[]): Promise<void>;
  /** Signed URLs valid for one hour, keyed by path. Unknown paths are omitted. */
  signedImageUrls(bucket: StorageBucket, paths: string[]): Promise<Record<string, string>>;
}
