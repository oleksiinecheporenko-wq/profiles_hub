// Domain models (Part A, section 5). Display formatting lives elsewhere.
//
// Table rows are mapped to camelCase. Version content keeps the DB column names
// (`project_catalog`, `additional_info`, …) and collection items keep their stored
// JSON keys (`image_path`, `date_from`, …): they are documents, and daily changes and
// the activity log refer to them by exactly these names.

import type {
  BillingMethod,
  ContractStatus,
  ExperienceLevel,
  LanguageLevel,
  ProfileStatus,
  ProfileVisibility,
} from "./enums";

export type Uuid = string;
/** ISO timestamp exactly as returned by the database; kept verbatim for concurrency checks. */
export type Timestamp = string;
/** DB `date` value, `yyyy-MM-dd`. */
export type PlainDate = string;

export type Profile = {
  id: Uuid;
  fullName: string;
  photoPath: string | null;
  profileUrl: string | null;
  status: ProfileStatus;
  statusChangedAt: Timestamp;
  visibility: ProfileVisibility | null;
  experienceLevel: ExperienceLevel | null;
  billingMethod: BillingMethod | null;
  education: string | null;
  categories: string[];
  email: string | null;
  /** IANA name. */
  timeZone: string | null;
  address: string | null;
  phone: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** Row of the `profile_overview` view. */
export type ProfileOverview = Profile & {
  currentVersionId: Uuid | null;
  title: string | null;
  activeContractsCount: number;
  lastActivityAt: Timestamp;
};

export type ProfileLanguage = {
  id: Uuid;
  profileId: Uuid;
  language: string;
  level: LanguageLevel;
  position: number;
};

// ---- Version content -------------------------------------------------------

export type PortfolioItem = {
  id: Uuid;
  title: string;
  description: string | null;
  url: string | null;
  image_path: string | null;
};

export type ProjectCatalogItem = {
  id: Uuid;
  title: string;
  description: string | null;
  price: number | null;
  url: string | null;
};

export type Certification = {
  id: Uuid;
  title: string;
  issuer: string | null;
  date: PlainDate | null;
  url: string | null;
};

export type EmploymentItem = {
  id: Uuid;
  company: string;
  position: string | null;
  date_from: PlainDate | null;
  /** null = по теперішній час. */
  date_to: PlainDate | null;
  description: string | null;
};

export type OtherExperience = {
  id: Uuid;
  title: string;
  description: string | null;
};

export type CollectionItemMap = {
  portfolio: PortfolioItem;
  project_catalog: ProjectCatalogItem;
  certifications: Certification;
  employment_history: EmploymentItem;
  other_experiences: OtherExperience;
};

export const COLLECTION_FIELDS = [
  "portfolio",
  "project_catalog",
  "certifications",
  "employment_history",
  "other_experiences",
] as const;
export type CollectionField = (typeof COLLECTION_FIELDS)[number];
export type CollectionItem = CollectionItemMap[CollectionField];

export type VersionContent = {
  title: string | null;
  rate: number | null;
  description: string | null;
  skills: string[];
  portfolio: PortfolioItem[];
  project_catalog: ProjectCatalogItem[];
  certifications: Certification[];
  employment_history: EmploymentItem[];
  other_experiences: OtherExperience[];
  additional_info: string | null;
};

export type ProfileVersion = {
  id: Uuid;
  profileId: Uuid;
  updateDate: PlainDate;
  isCurrent: boolean;
  content: VersionContent;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/** Version rail item. */
export type VersionSummary = {
  id: Uuid;
  updateDate: PlainDate;
  isCurrent: boolean;
  title: string | null;
  dailyChangeCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

// ---- Daily changes ---------------------------------------------------------

export const SCALAR_FIELDS = ["title", "rate", "description"] as const;
export type ScalarField = (typeof SCALAR_FIELDS)[number];

export const DAILY_CHANGE_FIELDS = [...SCALAR_FIELDS, "skills", ...COLLECTION_FIELDS] as const;
export type DailyChangeField = (typeof DAILY_CHANGE_FIELDS)[number];

export type ChangeType = "update" | "add" | "remove" | "reorder";

export type DailyChange = {
  id: Uuid;
  versionId: Uuid;
  profileId: Uuid;
  field: DailyChangeField;
  changeType: ChangeType;
  itemId: Uuid | null;
  oldValue: unknown;
  newValue: unknown;
  changedAt: Timestamp;
};

// ---- Contracts -------------------------------------------------------------

export type Contract = {
  id: Uuid;
  profileId: Uuid;
  createdDate: PlainDate;
  title: string;
  rate: number | null;
  description: string | null;
  dialog: string | null;
  status: ContractStatus;
  closedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ProfileRef = {
  id: Uuid;
  fullName: string;
  photoPath: string | null;
  profileUrl: string | null;
};

export type ContractListItem = Contract & { profile: ProfileRef };

export type ContractComment = {
  id: Uuid;
  contractId: Uuid;
  body: string;
  createdAt: Timestamp;
};

export type ContractDetail = ContractListItem & { comments: ContractComment[] };

// ---- Activity log ----------------------------------------------------------

export const ACTIVITY_ACTIONS = [
  "profile.created",
  "profile.updated",
  "profile.status_changed",
  "profile.languages_updated",
  "version.created",
  "version.edited",
  "version.daily_change",
  "contract.created",
  "contract.edited",
  "contract.closed",
  "contract.reopened",
  "contract.deleted",
  "contract.comment_added",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export type EntityType = "profile" | "profile_language" | "version" | "contract" | "contract_comment";

export type FieldChange = { old: unknown; new: unknown };

export type ActivityDetails = {
  /** UPDATE: only the columns that actually changed (DB column names). */
  changes?: Record<string, FieldChange>;
  /** INSERT/DELETE: the row snapshot. */
  row?: Record<string, unknown>;
  reason?: string;
};

export type ActivityRow = {
  id: Uuid;
  occurredAt: Timestamp;
  txId: number;
  profileId: Uuid | null;
  entityType: EntityType;
  entityId: Uuid | null;
  /** Free text: direct DB edits may produce actions outside ACTIVITY_ACTIONS. */
  action: string;
  details: ActivityDetails;
};

/** One user action = all log rows written in one transaction. */
export type ActivityEntry = {
  txId: number;
  occurredAt: Timestamp;
  action: string;
  profileId: Uuid | null;
  profile: ProfileRef | null;
  rows: ActivityRow[];
};
