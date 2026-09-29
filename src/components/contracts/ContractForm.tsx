"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ExternalLink, Lock } from "lucide-react";
import { createContractAction, updateContractAction } from "@/app/(app)/contracts/actions";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { controlClassName, Field } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useToast } from "@/components/ui/Toast";
import { fieldErrorsFromZod } from "@/lib/actions/result";
import type { Timestamp } from "@/lib/domain/types";
import { contractInputSchema } from "@/lib/validation/contract";

export type ProfileChoice = { id: string; fullName: string; profileUrl: string | null };

export type ContractFormValues = {
  profileId: string | null;
  createdDate: string;
  title: string;
  rate: string;
  description: string;
  dialog: string;
};

type Props = {
  profiles: ProfileChoice[];
  initial: ContractFormValues;
  /** Preselected profile that cannot be changed (`/contracts/new?profile=`). */
  lockedProfile?: boolean;
  cancelHref: string;
} & ({ mode: "create" } | { mode: "edit"; contractId: string; expectedUpdatedAt: Timestamp });

/** Textarea that grows with its content; line breaks are kept exactly. */
function AutoGrowTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const { minRows = 8, className, value, ...rest } = props;
  const rows = Math.max(minRows, String(value ?? "").split("\n").length + 1);
  return (
    <textarea
      {...rest}
      value={value}
      rows={Math.min(rows, 60)}
      className={clsx(controlClassName, "resize-y py-2 leading-relaxed", className)}
    />
  );
}

export function ContractForm(props: Props) {
  const { profiles, initial, lockedProfile, cancelHref } = props;
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<ContractFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const profile = profiles.find((p) => p.id === values.profileId) ?? null;
  const set = <K extends keyof ContractFormValues>(key: K, value: ContractFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _removed, ...rest }) => (void _removed, rest));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const rateText = values.rate.trim().replace(",", ".");
    const rate = rateText === "" ? null : Number(rateText);
    const candidate = {
      profileId: values.profileId ?? "",
      createdDate: values.createdDate,
      title: values.title,
      rate: rate !== null && Number.isFinite(rate) ? rate : rateText === "" ? null : NaN,
      description: values.description,
      dialog: values.dialog,
    };
    const parsed = contractInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const found = fieldErrorsFromZod(parsed.error);
      if (found.profileId) found.profileId = "Оберіть профіль.";
      setErrors(found);
      toast.error(Object.values(found)[0] ?? "Перевірте поля форми.");
      return;
    }
    startTransition(async () => {
      const result =
        props.mode === "create"
          ? await createContractAction(parsed.data)
          : await updateContractAction(props.contractId, parsed.data, props.expectedUpdatedAt);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(props.mode === "create" ? "Контракт створено." : "Контракт збережено.");
      router.push(`/contracts/${result.data.id}`);
      router.refresh();
    });
  };

  const cancel = () => (dirty ? setConfirmLeave(true) : router.push(cancelHref));

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl">
      <div className="flex flex-col gap-5 rounded-lg border border-line bg-surface-1/40 p-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Профіль" required error={errors.profileId}>
            {(p) =>
              lockedProfile && profile ? (
                <div className="flex h-10 items-center gap-2 rounded-md border border-line bg-surface-2 px-3 text-sm text-fg-2" id={p.id}>
                  <Lock className="size-3.5 text-fg-muted" aria-hidden />
                  <span className="truncate">{profile.fullName}</span>
                </div>
              ) : (
                <SearchableSelect
                  {...p}
                  value={values.profileId}
                  onChange={(v) => set("profileId", v)}
                  options={profiles.map((x) => ({ value: x.id, label: x.fullName }))}
                  placeholder="Оберіть профіль"
                  autoFocus={props.mode === "create"}
                />
              )
            }
          </Field>
          <Field label="Посилання на профіль">
            {(p) => (
              <div id={p.id} className="flex h-10 min-w-0 items-center gap-2 rounded-md border border-line bg-surface-2 px-3 text-sm">
                {profile?.profileUrl ? (
                  <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 text-fg-2 hover:text-accent">
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate font-mono text-xs">{profile.profileUrl}</span>
                  </a>
                ) : (
                  <span className="text-fg-muted">{profile ? "Посилання не вказано" : "—"}</span>
                )}
              </div>
            )}
          </Field>
          <Field label="Дата створення" required error={errors.createdDate}>
            {(p) => (
              <input
                {...p}
                type="date"
                value={values.createdDate}
                onChange={(e) => set("createdDate", e.target.value)}
                className={clsx(controlClassName, "h-10 font-mono [color-scheme:dark]")}
              />
            )}
          </Field>
          <Field label="Рейт" error={errors.rate}>
            {(p) => (
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm text-fg-muted">$</span>
                <input
                  {...p}
                  inputMode="decimal"
                  value={values.rate}
                  onChange={(e) => set("rate", e.target.value)}
                  className={clsx(controlClassName, "h-10 pl-7 font-mono")}
                />
              </div>
            )}
          </Field>
        </div>
        <Field label="Тайтл" required error={errors.title}>
          {(p) => (
            <input
              {...p}
              value={values.title}
              maxLength={300}
              autoFocus={props.mode === "create" && lockedProfile}
              onChange={(e) => set("title", e.target.value)}
              className={clsx(controlClassName, "h-10")}
            />
          )}
        </Field>
        <Field label="Опис" error={errors.description}>
          {(p) => (
            <textarea
              {...p}
              rows={4}
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              className={clsx(controlClassName, "resize-y py-2 leading-relaxed")}
            />
          )}
        </Field>
        <Field label="Діалог" error={errors.dialog} hint="Вставте листування: переноси рядків зберігаються як є.">
          {(p) => <AutoGrowTextarea {...p} value={values.dialog} onChange={(e) => set("dialog", e.target.value)} />}
        </Field>
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
          router.push(cancelHref);
        }}
      />
    </form>
  );
}
