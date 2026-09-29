"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  setLanguagesAction,
  updateContentFieldAction,
  updateProfileFieldsAction,
} from "@/app/(app)/profiles/[id]/actions";
import { Settings2, UserRoundPen } from "lucide-react";
import { SectionHeading } from "@/components/ui/FieldLabel";
import { InlineEditableField } from "@/components/ui/InlineEditableField";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/actions/result";
import {
  BILLING_METHODS,
  BILLING_METHOD_LABELS,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
  PROFILE_VISIBILITIES,
  PROFILE_VISIBILITY_LABELS,
} from "@/lib/domain/enums";
import type { ProfileLanguage, ProfileOverview, Timestamp } from "@/lib/domain/types";
import { formatRate } from "@/lib/format";
import { timeZoneLabel, timeZoneOptions } from "@/lib/reference/timezones";
import { categoriesSchema, MAX_DESCRIPTION, optionalEmail } from "@/lib/validation/common";
import { profileFieldsPatchSchema } from "@/lib/validation/profile";
import { descriptionSchema, rateSchema, titleSchema } from "@/lib/validation/version";
import { LanguagesField } from "./LanguagesField";

export type CurrentVersionFields = {
  id: string;
  updatedAt: Timestamp;
  title: string | null;
  rate: number | null;
  description: string | null;
};

const options = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((v) => ({ value: v, label: labels[v] }));

const zodError = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }) =>
  (value: unknown) => {
    const r = schema.safeParse(value);
    return r.success ? null : (r.error?.issues[0]?.message ?? "Некоректне значення.");
  };

function CurrentVersionBadge() {
  return (
    <span className="inline-flex h-5 items-center rounded-sm bg-accent-soft px-1.5 font-mono text-[10px] tracking-wide text-accent">
      з Актуальної версії
    </span>
  );
}

export function MainInfoTab({
  profile,
  languages,
  version,
}: {
  profile: ProfileOverview;
  languages: ProfileLanguage[];
  version: CurrentVersionFields | null;
}) {
  const router = useRouter();
  const toast = useToast();

  // The current version's updated_at, advanced after each successful daily change so
  // consecutive edits don't trip the concurrency check. Re-synced when the server
  // sends a newer version (adjusting state during render, not in an effect).
  const [stamp, setStamp] = useState(version?.updatedAt ?? "");
  const [seenPropStamp, setSeenPropStamp] = useState(version?.updatedAt ?? "");
  if (version && version.updatedAt !== seenPropStamp) {
    setSeenPropStamp(version.updatedAt);
    if (version.updatedAt > stamp) setStamp(version.updatedAt);
  }

  const tzOptions = useMemo(() => timeZoneOptions(), []);

  const handle = async (result: ActionResult<unknown>, success: string) => {
    if (!result.ok) {
      toast.error(result.error);
      return result.fieldErrors ? Object.values(result.fieldErrors)[0] : result.error;
    }
    toast.success(success);
    router.refresh();
    return null;
  };

  const saveAccount = (key: string) => async (value: unknown) =>
    handle(await updateProfileFieldsAction(profile.id, { [key]: value }), "Збережено.");

  const saveContent = (field: "title" | "rate" | "description") => async (value: unknown) => {
    if (!version) return "Актуальну версію не знайдено.";
    const result = await updateContentFieldAction(
      { profileId: profile.id, versionId: version.id, expectedUpdatedAt: stamp },
      { field, value },
    );
    if (result.ok) setStamp(result.data.updatedAt);
    return handle(result, "Збережено в Актуальну версію.");
  };

  const accountCheck = (key: string) => (value: unknown) => zodError(profileFieldsPatchSchema)({ [key]: value });

  return (
    <div className="grid grid-cols-[minmax(0,62fr)_minmax(0,38fr)] gap-8">
      <section aria-labelledby="profile-content-heading">
        <SectionHeading id="profile-content-heading" icon={UserRoundPen} className="mb-2">
          Вміст профілю
        </SectionHeading>
        <div className="rounded-lg border border-line bg-surface-1 px-4">
          <InlineEditableField
            kind="text"
            label="Title"
            badge={<CurrentVersionBadge />}
            value={version?.title ?? null}
            maxLength={300}
            disabled={!version}
            validate={zodError(titleSchema)}
            onSave={saveContent("title")}
          />
          <InlineEditableField
            kind="number"
            label="Rate"
            badge={<CurrentVersionBadge />}
            value={version?.rate ?? null}
            format={(v) => formatRate(v)}
            prefix="$"
            suffix="/год"
            disabled={!version}
            validate={zodError(rateSchema)}
            onSave={saveContent("rate")}
          />
          <InlineEditableField
            kind="textarea"
            label="Description"
            badge={<CurrentVersionBadge />}
            value={version?.description ?? null}
            counter={MAX_DESCRIPTION}
            disabled={!version}
            validate={zodError(descriptionSchema)}
            onSave={saveContent("description")}
          />
          <LanguagesField
            languages={languages}
            onSave={async (rows) => handle(await setLanguagesAction(profile.id, rows), "Мови збережено.")}
          />
          <InlineEditableField
            kind="text"
            label="Education"
            value={profile.education}
            validate={accountCheck("education")}
            onSave={saveAccount("education")}
          />
          <InlineEditableField
            kind="tags"
            label="Categories"
            value={profile.categories}
            validate={zodError(categoriesSchema)}
            onSave={saveAccount("categories")}
          />
        </div>
      </section>

      <section aria-labelledby="account-details-heading">
        <SectionHeading id="account-details-heading" icon={Settings2} className="mb-2">
          Дані акаунта
        </SectionHeading>
        <div className="rounded-lg border border-line bg-surface-1 px-4 [--label-w:112px]">
          <InlineEditableField
            kind="select"
            label="Visibility"
            value={profile.visibility}
            options={options(PROFILE_VISIBILITIES, PROFILE_VISIBILITY_LABELS)}
            onSave={saveAccount("visibility")}
          />
          <InlineEditableField
            kind="select"
            label="Experience level"
            value={profile.experienceLevel}
            options={options(EXPERIENCE_LEVELS, EXPERIENCE_LEVEL_LABELS)}
            onSave={saveAccount("experienceLevel")}
          />
          <InlineEditableField
            kind="text"
            label="Email"
            inputType="email"
            value={profile.email}
            validate={zodError(optionalEmail)}
            onSave={saveAccount("email")}
          />
          <InlineEditableField
            kind="select"
            label="Billing method"
            value={profile.billingMethod}
            options={options(BILLING_METHODS, BILLING_METHOD_LABELS)}
            onSave={saveAccount("billingMethod")}
          />
          <InlineEditableField
            kind="searchable"
            label="Time Zone"
            value={profile.timeZone}
            options={
              profile.timeZone && !tzOptions.some((o) => o.value === profile.timeZone)
                ? [{ value: profile.timeZone, label: timeZoneLabel(profile.timeZone) }, ...tzOptions]
                : tzOptions
            }
            validate={accountCheck("timeZone")}
            onSave={saveAccount("timeZone")}
          />
          <InlineEditableField
            kind="text"
            label="Address"
            value={profile.address}
            validate={accountCheck("address")}
            onSave={saveAccount("address")}
          />
          <InlineEditableField
            kind="text"
            label="Phone"
            inputType="tel"
            value={profile.phone}
            validate={accountCheck("phone")}
            onSave={saveAccount("phone")}
          />
        </div>
      </section>
    </div>
  );
}
