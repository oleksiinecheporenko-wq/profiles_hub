"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import {
  createGlobalVersionAction,
  editGlobalVersionAction,
} from "@/app/(app)/profiles/[id]/versionActions";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { controlClassName } from "@/components/ui/Input";
import { TagInput } from "@/components/ui/TagInput";
import { useToast } from "@/components/ui/Toast";
import { FIELD_LABELS } from "@/lib/domain/collections";
import { COLLECTION_FIELDS, type CollectionField, type CollectionItem, type Timestamp, type VersionContent } from "@/lib/domain/types";
import type { VersionPayload } from "@/lib/domain/versions";
import { MAX_DESCRIPTION, MAX_SKILLS } from "@/lib/validation/common";
import { versionPayloadSchema } from "@/lib/validation/version";
import { CollectionEditor } from "./CollectionEditor";

type Props = {
  profileId: string;
  initial: VersionPayload;
  imageUrls: Record<string, string>;
  /** Updates tab URL; Cancel and a successful save go there (with `&version=`). */
  baseHref: string;
} & (
  | { mode: "create" }
  | { mode: "edit"; versionId: string; expectedUpdatedAt: Timestamp; archived: boolean }
);

type Errors = Record<string, string>;

/** Maps zod issue paths to form keys: `title`, `portfolio.<itemId>.title`, … */
function mapErrors(issues: { path: PropertyKey[]; message: string }[], content: VersionContent): Errors {
  const out: Errors = {};
  for (const issue of issues) {
    const [root, field, index, key] = issue.path;
    let k: string;
    if (root === "updateDate") k = "updateDate";
    else if (typeof field === "string" && (COLLECTION_FIELDS as readonly string[]).includes(field) && typeof index === "number") {
      const item = content[field as CollectionField][index];
      k = key !== undefined ? `${field}.${item?.id}.${String(key)}` : `${field}`;
    } else k = String(field ?? root);
    out[k] ??= issue.message;
  }
  return out;
}

function Row({ index, label, htmlFor, error, children, hint }: {
  index: number;
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[168px_minmax(0,1fr)] gap-x-6 border-b border-line py-4 last:border-b-0">
      <label htmlFor={htmlFor} className="pt-2.5 font-mono text-[11px] tracking-wide text-fg-muted uppercase">
        {String(index).padStart(2, "0")} / {label}
      </label>
      <div className="min-w-0">
        {children}
        {(error || hint) && (
          <div className="mt-1 flex justify-between gap-3 text-xs">
            <span className="text-negative">{error}</span>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

export function VersionForm(props: Props) {
  const { profileId, initial, baseHref } = props;
  const hrefFor = (versionId: string | null) => (versionId ? `${baseHref}&version=${versionId}` : baseHref);
  const router = useRouter();
  const toast = useToast();
  const [updateDate, setUpdateDate] = useState(initial.updateDate);
  const [content, setContent] = useState<VersionContent>(() => structuredClone(initial.content));
  const [rateText, setRateText] = useState(initial.content.rate === null ? "" : String(initial.content.rate));
  const [errors, setErrors] = useState<Errors>({});
  const [imageUrls, setImageUrls] = useState(props.imageUrls);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [pending, startTransition] = useTransition();

  const payload = useMemo<VersionPayload>(() => ({ updateDate, content }), [updateDate, content]);
  const dirty = useMemo(
    () => JSON.stringify(payload) !== JSON.stringify({ updateDate: initial.updateDate, content: initial.content }),
    [payload, initial],
  );

  // Warn before closing the tab with unsaved input.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = <K extends keyof VersionContent>(key: K, value: VersionContent[K]) => {
    setContent((c) => ({ ...c, [key]: value }));
  };

  const cancelHref = props.mode === "edit" ? hrefFor(props.versionId) : hrefFor(null);
  const cancel = () => (dirty ? setConfirmLeave(true) : router.push(cancelHref, { scroll: false }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const rate = rateText.trim() === "" ? null : Number(rateText.replace(",", "."));
    const candidate = { updateDate, content: { ...content, rate } };
    const parsed = versionPayloadSchema.safeParse(candidate);
    if (!parsed.success || (rate !== null && !Number.isFinite(rate))) {
      const mapped = parsed.success ? {} : mapErrors(parsed.error.issues, content);
      if (rate !== null && !Number.isFinite(rate)) mapped.rate = "Вкажіть число.";
      setErrors(mapped);
      toast.error(Object.values(mapped)[0] ?? "Перевірте поля форми.");
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createGlobalVersionAction(profileId, parsed.data)
          : await editGlobalVersionAction(
              { profileId, versionId: props.versionId, expectedUpdatedAt: props.expectedUpdatedAt },
              parsed.data,
            );
      if (!result.ok) {
        // Keep the user's input; conflicts get the message from Part A.
        toast.error(result.error);
        return;
      }
      toast.success(props.mode === "create" ? "Глобальне оновлення створено." : "Версію збережено.");
      router.push(hrefFor(result.data.id), { scroll: false });
      router.refresh();
    });
  };

  let n = 1;
  const collectionErrors = (field: CollectionField) => {
    const prefix = `${field}.`;
    const out: Errors = {};
    for (const [k, v] of Object.entries(errors)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
    return out;
  };
  const collection = (field: CollectionField) => (
    <Row index={n++} label={FIELD_LABELS[field]} error={errors[field]}>
      <CollectionEditor
        field={field}
        items={content[field] as CollectionItem[]}
        onChange={(items) => set(field, items as never)}
        errors={collectionErrors(field)}
        imageUrls={imageUrls}
        onImageUploaded={(path, url) => url && setImageUrls((m) => ({ ...m, [path]: url }))}
      />
    </Row>
  );

  return (
    <form onSubmit={submit} noValidate className="min-w-0">
      <div className="pb-3">
        <p className="font-mono text-xs text-fg-muted">{props.mode === "create" ? "// new global update" : "// edit version"}</p>
        <h2 className="mt-1 text-lg font-semibold">
          {props.mode === "create" ? "Нове глобальне оновлення" : "Редагування версії"}
        </h2>
        {props.mode === "create" && (
          <p className="mt-1 text-[13px] text-fg-muted">
            Поля скопійовано з Актуальної версії. Після збереження нова версія стане актуальною.
          </p>
        )}
        {props.mode === "edit" && props.archived && (
          <p className="mt-2 flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-[13px] text-warning">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            Ви редагуєте архівну версію. Зміни буде записано в Дії.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-line bg-surface-1/40 px-5">
        <Row index={n++} label={FIELD_LABELS.update_date} htmlFor="v-date" error={errors.updateDate}>
          <input
            id="v-date"
            type="date"
            required
            value={updateDate}
            onChange={(e) => setUpdateDate(e.target.value)}
            className={clsx(controlClassName, "h-10 w-48 font-mono [color-scheme:dark]")}
          />
        </Row>
        <Row index={n++} label="Title" htmlFor="v-title" error={errors.title}>
          <input
            id="v-title"
            value={content.title ?? ""}
            maxLength={300}
            onChange={(e) => set("title", e.target.value === "" ? null : e.target.value)}
            className={clsx(controlClassName, "h-10")}
          />
        </Row>
        <Row index={n++} label="Rate" htmlFor="v-rate" error={errors.rate}>
          <div className="relative w-48">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm text-fg-muted">$</span>
            <input
              id="v-rate"
              inputMode="decimal"
              value={rateText}
              onChange={(e) => {
                setRateText(e.target.value);
                const raw = e.target.value.trim().replace(",", ".");
                const num = raw === "" ? null : Number(raw);
                set("rate", num !== null && Number.isFinite(num) ? num : null);
              }}
              className={clsx(controlClassName, "h-10 pr-14 pl-7 font-mono")}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-fg-muted">/год</span>
          </div>
        </Row>
        <Row
          index={n++}
          label="Description"
          htmlFor="v-description"
          error={errors.description}
          hint={
            <span className={clsx("font-mono", (content.description?.length ?? 0) > MAX_DESCRIPTION ? "text-negative" : "text-fg-muted")}>
              {content.description?.length ?? 0} / {MAX_DESCRIPTION}
            </span>
          }
        >
          <textarea
            id="v-description"
            rows={8}
            value={content.description ?? ""}
            onChange={(e) => set("description", e.target.value === "" ? null : e.target.value)}
            className={clsx(controlClassName, "resize-y py-2 leading-relaxed")}
          />
        </Row>
        {collection("portfolio")}
        <Row index={n++} label="Skills" htmlFor="v-skills" error={errors.skills}>
          <TagInput id="v-skills" value={content.skills} onChange={(v) => set("skills", v)} max={MAX_SKILLS} />
        </Row>
        {collection("project_catalog")}
        {collection("certifications")}
        {collection("employment_history")}
        {collection("other_experiences")}
        <Row index={n++} label={FIELD_LABELS.additional_info} htmlFor="v-info" error={errors.additional_info}>
          <textarea
            id="v-info"
            rows={4}
            value={content.additional_info ?? ""}
            onChange={(e) => set("additional_info", e.target.value === "" ? null : e.target.value)}
            className={clsx(controlClassName, "resize-y py-2 leading-relaxed")}
          />
        </Row>
      </div>

      <div className="sticky bottom-0 z-10 mt-4 flex items-center justify-end gap-2 border-t border-line bg-bg/95 py-3 backdrop-blur-sm">
        {dirty && <span className="mr-auto text-[13px] text-fg-muted">Є незбережені зміни</span>}
        <Button onClick={cancel} disabled={pending}>
          Скасувати
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          Зберегти
        </Button>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        title="Скасувати зміни?"
        message="Незбережені зміни буде втрачено."
        confirmLabel="Скасувати зміни"
        cancelLabel="Продовжити редагування"
        tone="danger"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          router.push(cancelHref, { scroll: false });
        }}
      />
    </form>
  );
}
