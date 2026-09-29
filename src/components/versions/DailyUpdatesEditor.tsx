"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { applyDailyChangeAction } from "@/app/(app)/profiles/[id]/versionActions";
import { InlineEditableField } from "@/components/ui/InlineEditableField";
import { useToast } from "@/components/ui/Toast";
import type { DailyChangeInput } from "@/lib/domain/dailyChanges";
import type { CollectionField, CollectionItem, ProfileVersion, VersionContent } from "@/lib/domain/types";
import { formatRate } from "@/lib/format";
import { MAX_DESCRIPTION, MAX_SKILLS, skillsSchema } from "@/lib/validation/common";
import { descriptionSchema, rateSchema, titleSchema } from "@/lib/validation/version";
import { DailyCollection } from "./DailyCollection";

const zodError = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }) =>
  (value: unknown) => {
    const r = schema.safeParse(value);
    return r.success ? null : (r.error?.issues[0]?.message ?? "Некоректне значення.");
  };

function Block({ index, label, children }: { index: number; label: string; children: ReactNode }) {
  return (
    <section className="border-b border-line py-4 last:border-b-0">
      <h3 className="mb-2 font-mono text-[11px] tracking-wide text-fg-muted uppercase">
        {String(index).padStart(2, "0")} / {label}
      </h3>
      {children}
    </section>
  );
}

/**
 * Editable content of the current version. Every save is one daily change with the
 * version's `updated_at` as the concurrency check; the stamp advances after each save.
 */
export function DailyUpdatesEditor({
  profileId,
  version,
  imageUrls: initialImageUrls,
}: {
  profileId: string;
  version: ProfileVersion;
  imageUrls: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [content, setContent] = useState<VersionContent>(version.content);
  const [stamp, setStamp] = useState(version.updatedAt);
  const [seen, setSeen] = useState(version.updatedAt);
  const [imageUrls, setImageUrls] = useState(initialImageUrls);

  // A newer version from the server (e.g. after refresh) replaces local state.
  if (version.updatedAt !== seen) {
    setSeen(version.updatedAt);
    if (version.updatedAt > stamp) {
      setStamp(version.updatedAt);
      setContent(version.content);
    }
  }

  const apply = async (change: DailyChangeInput): Promise<string | null> => {
    const result = await applyDailyChangeAction({ profileId, versionId: version.id, expectedUpdatedAt: stamp }, change);
    if (!result.ok) {
      toast.error(result.error);
      return result.fieldErrors ? (Object.values(result.fieldErrors)[0] ?? result.error) : result.error;
    }
    setStamp(result.data.updatedAt);
    setContent(result.data.content);
    toast.success("Зміну збережено в Актуальну версію.");
    router.refresh();
    return null;
  };

  const collection = (index: number, field: CollectionField, label: string) => (
    <Block index={index} label={label}>
      <DailyCollection
        field={field}
        items={content[field] as CollectionItem[]}
        apply={apply}
        imageUrls={imageUrls}
        onImageUploaded={(path, url) => url && setImageUrls((m) => ({ ...m, [path]: url }))}
      />
    </Block>
  );

  return (
    <div className="rounded-lg border border-line bg-surface-1/40 px-5">
      <div className="-mx-1 border-b border-line [--label-w:140px]">
        <InlineEditableField
          kind="text"
          label="01 / Title"
          labelStyle="mono"
          value={content.title}
          maxLength={300}
          validate={zodError(titleSchema)}
          onSave={(value) => apply({ field: "title", value })}
        />
        <InlineEditableField
          kind="number"
          label="02 / Rate"
          labelStyle="mono"
          value={content.rate}
          format={(v) => formatRate(v)}
          prefix="$"
          suffix="/год"
          validate={zodError(rateSchema)}
          onSave={(value) => apply({ field: "rate", value })}
        />
        <InlineEditableField
          kind="textarea"
          label="03 / Description"
          labelStyle="mono"
          value={content.description}
          counter={MAX_DESCRIPTION}
          validate={zodError(descriptionSchema)}
          onSave={(value) => apply({ field: "description", value })}
        />
      </div>
      {collection(4, "portfolio", "Portfolio")}
      <div className="-mx-1 border-b border-line [--label-w:140px]">
        <InlineEditableField
          kind="tags"
          label="05 / Skills"
          labelStyle="mono"
          value={content.skills}
          max={MAX_SKILLS}
          validate={zodError(skillsSchema)}
          onSave={(value) => apply({ field: "skills", value })}
        />
      </div>
      {collection(6, "project_catalog", "Project Catalog")}
      {collection(7, "certifications", "Certifications")}
      {collection(8, "employment_history", "Employment history")}
      {collection(9, "other_experiences", "Other experiences")}
    </div>
  );
}
