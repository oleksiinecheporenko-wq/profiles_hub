// Database row shapes (snake_case, as stored) and mappers to domain models.
// Shared by the Supabase repository (reading rows) and the mock repository
// (writing activity log details with the same column names the triggers use).

import type {
  BillingMethod,
  ContractStatus,
  ExperienceLevel,
  LanguageLevel,
  ProfileStatus,
  ProfileVisibility,
} from "@/lib/domain/enums";
import type {
  ActivityDetails,
  ActivityRow,
  Contract,
  ContractComment,
  DailyChange,
  EntityType,
  Profile,
  ProfileLanguage,
  ProfileOverview,
  ProfileVersion,
  VersionContent,
} from "@/lib/domain/types";

export type ProfileRow = {
  id: string;
  full_name: string;
  photo_path: string | null;
  profile_url: string | null;
  status: ProfileStatus;
  status_changed_at: string;
  visibility: ProfileVisibility | null;
  experience_level: ExperienceLevel | null;
  billing_method: BillingMethod | null;
  education: string | null;
  categories: string[];
  email: string | null;
  time_zone: string | null;
  address: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileOverviewRow = ProfileRow & {
  current_version_id: string | null;
  title: string | null;
  active_contracts_count: number;
  last_activity_at: string;
};

export type ProfileLanguageRow = {
  id: string;
  profile_id: string;
  language: string;
  level: LanguageLevel;
  position: number;
};

export type ProfileVersionRow = VersionContent & {
  id: string;
  profile_id: string;
  update_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

export type DailyChangeRow = {
  id: string;
  version_id: string;
  profile_id: string;
  field: DailyChange["field"];
  change_type: DailyChange["changeType"];
  item_id: string | null;
  old_value: unknown;
  new_value: unknown;
  changed_at: string;
};

export type ContractRow = {
  id: string;
  profile_id: string;
  created_date: string;
  title: string;
  rate: number | string | null;
  description: string | null;
  dialog: string | null;
  status: ContractStatus;
  closed_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractCommentRow = {
  id: string;
  contract_id: string;
  body: string;
  created_at: string;
  actor_id: string | null;
};

export type ActivityLogRow = {
  id: string;
  occurred_at: string;
  tx_id: number | string;
  profile_id: string | null;
  entity_type: EntityType;
  entity_id: string | null;
  action: string;
  details: ActivityDetails;
  actor_id: string | null;
};

// numeric columns may arrive as strings from PostgREST.
export const toNumber = (v: number | string | null): number | null =>
  v === null ? null : typeof v === "number" ? v : Number(v);

export function profileFromRow(r: ProfileRow): Profile {
  return {
    id: r.id,
    fullName: r.full_name,
    photoPath: r.photo_path,
    profileUrl: r.profile_url,
    status: r.status,
    statusChangedAt: r.status_changed_at,
    visibility: r.visibility,
    experienceLevel: r.experience_level,
    billingMethod: r.billing_method,
    education: r.education,
    categories: r.categories ?? [],
    email: r.email,
    timeZone: r.time_zone,
    address: r.address,
    phone: r.phone,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function profileToRow(p: Profile): ProfileRow {
  return {
    id: p.id,
    full_name: p.fullName,
    photo_path: p.photoPath,
    profile_url: p.profileUrl,
    status: p.status,
    status_changed_at: p.statusChangedAt,
    visibility: p.visibility,
    experience_level: p.experienceLevel,
    billing_method: p.billingMethod,
    education: p.education,
    categories: p.categories,
    email: p.email,
    time_zone: p.timeZone,
    address: p.address,
    phone: p.phone,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function profileOverviewFromRow(r: ProfileOverviewRow): ProfileOverview {
  return {
    ...profileFromRow(r),
    currentVersionId: r.current_version_id,
    title: r.title,
    activeContractsCount: Number(r.active_contracts_count ?? 0),
    lastActivityAt: r.last_activity_at,
  };
}

export function languageFromRow(r: ProfileLanguageRow): ProfileLanguage {
  return { id: r.id, profileId: r.profile_id, language: r.language, level: r.level, position: r.position };
}

export function languageToRow(l: ProfileLanguage): ProfileLanguageRow {
  return { id: l.id, profile_id: l.profileId, language: l.language, level: l.level, position: l.position };
}

export function versionFromRow(r: ProfileVersionRow): ProfileVersion {
  return {
    id: r.id,
    profileId: r.profile_id,
    updateDate: r.update_date,
    isCurrent: r.is_current,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    content: {
      title: r.title,
      rate: toNumber(r.rate as number | string | null),
      description: r.description,
      skills: r.skills ?? [],
      portfolio: r.portfolio ?? [],
      project_catalog: (r.project_catalog ?? []).map((i) => ({ ...i, price: toNumber(i.price) })),
      certifications: r.certifications ?? [],
      employment_history: r.employment_history ?? [],
      other_experiences: r.other_experiences ?? [],
      additional_info: r.additional_info,
    },
  };
}

export function versionToRow(v: ProfileVersion): ProfileVersionRow {
  return {
    id: v.id,
    profile_id: v.profileId,
    update_date: v.updateDate,
    is_current: v.isCurrent,
    ...v.content,
    created_at: v.createdAt,
    updated_at: v.updatedAt,
  };
}

export function dailyChangeFromRow(r: DailyChangeRow): DailyChange {
  return {
    id: r.id,
    versionId: r.version_id,
    profileId: r.profile_id,
    field: r.field,
    changeType: r.change_type,
    itemId: r.item_id,
    oldValue: r.old_value,
    newValue: r.new_value,
    changedAt: r.changed_at,
  };
}

export function dailyChangeToRow(c: DailyChange): DailyChangeRow {
  return {
    id: c.id,
    version_id: c.versionId,
    profile_id: c.profileId,
    field: c.field,
    change_type: c.changeType,
    item_id: c.itemId,
    old_value: c.oldValue,
    new_value: c.newValue,
    changed_at: c.changedAt,
  };
}

export function contractFromRow(r: ContractRow): Contract {
  return {
    id: r.id,
    profileId: r.profile_id,
    createdDate: r.created_date,
    title: r.title,
    rate: toNumber(r.rate),
    description: r.description,
    dialog: r.dialog,
    status: r.status,
    closedAt: r.closed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function contractToRow(c: Contract, deletedAt: string | null): ContractRow {
  return {
    id: c.id,
    profile_id: c.profileId,
    created_date: c.createdDate,
    title: c.title,
    rate: c.rate,
    description: c.description,
    dialog: c.dialog,
    status: c.status,
    closed_at: c.closedAt,
    deleted_at: deletedAt,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export function commentFromRow(r: ContractCommentRow): ContractComment {
  return { id: r.id, contractId: r.contract_id, body: r.body, createdAt: r.created_at };
}

export function commentToRow(c: ContractComment): ContractCommentRow {
  return { id: c.id, contract_id: c.contractId, body: c.body, created_at: c.createdAt, actor_id: null };
}

export function activityFromRow(r: ActivityLogRow): ActivityRow {
  return {
    id: r.id,
    occurredAt: r.occurred_at,
    txId: Number(r.tx_id),
    profileId: r.profile_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    action: r.action,
    details: r.details ?? {},
  };
}

export function activityToRow(a: ActivityRow): ActivityLogRow {
  return {
    id: a.id,
    occurred_at: a.occurredAt,
    tx_id: a.txId,
    profile_id: a.profileId,
    entity_type: a.entityType,
    entity_id: a.entityId,
    action: a.action,
    details: a.details,
    actor_id: null,
  };
}
