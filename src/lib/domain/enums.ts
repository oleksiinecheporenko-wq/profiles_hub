// DB enum values and their UI labels (Part A, section 5).

export const PROFILE_STATUSES = ["active", "hold", "ban", "back_to_developer"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];
export const PROFILE_STATUS_LABELS: Record<ProfileStatus, string> = {
  active: "Active",
  hold: "Hold",
  ban: "Ban",
  back_to_developer: "Back to Developer",
};

export const PROFILE_VISIBILITIES = ["public", "upwork_only", "private"] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];
export const PROFILE_VISIBILITY_LABELS: Record<ProfileVisibility, string> = {
  public: "Public",
  upwork_only: "Only Upwork users",
  private: "Private",
};

export const EXPERIENCE_LEVELS = ["entry", "intermediate", "expert"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  entry: "Entry level",
  intermediate: "Intermediate",
  expert: "Expert",
};

export const BILLING_METHODS = ["card", "paypal"] as const;
export type BillingMethod = (typeof BILLING_METHODS)[number];
export const BILLING_METHOD_LABELS: Record<BillingMethod, string> = {
  card: "Debit or credit card",
  paypal: "PayPal",
};

export const LANGUAGE_LEVELS = ["basic", "conversational", "fluent", "native"] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];
export const LANGUAGE_LEVEL_LABELS: Record<LanguageLevel, string> = {
  basic: "Basic",
  conversational: "Conversational",
  fluent: "Fluent",
  native: "Native or Bilingual",
};

export const CONTRACT_STATUSES = ["active", "closed"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: "Активний",
  closed: "Закритий",
};
