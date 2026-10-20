"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, MoreHorizontal, Trash2 } from "lucide-react";
import { deleteEstimateAction, updateInfoAction } from "@/app/(app)/estimates/actions";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Menu } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { STATUS_LABELS, STATUS_SECTIONS, type Estimate } from "@/lib/domain/estimate";
import { DateLine } from "./DateLine";

const STATUS_TONE = {
  in_progress: "border-warning/30 bg-warning-soft text-warning",
  ready: "border-positive/30 bg-positive-soft text-positive",
  archived: "border-line-strong bg-neutral-soft text-fg-2",
} as const;

const bareInput =
  "w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 -mx-2 transition-colors duration-150 hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none";

type Props = {
  estimate: Pick<Estimate, "id" | "clientName" | "projectName" | "status" | "createdAt" | "readyAt">;
};

/** Title (client), subtitle (project), the date line, status and delete. */
export function EstimateHeader({ estimate }: Props) {
  const [clientName, setClientName] = useState(estimate.clientName);
  const [projectName, setProjectName] = useState(estimate.projectName ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const section = STATUS_SECTIONS[estimate.status];
  const editable = estimate.status !== "archived";

  async function save(field: "clientName" | "projectName", value: string, saved: string | null) {
    const next = value.trim();
    if (next === (saved ?? "")) return;
    if (field === "clientName" && !next) {
      setClientName(estimate.clientName);
      toast.error("Ім’я клієнта не може бути порожнім.");
      return;
    }
    const result = await updateInfoAction(estimate.id, { [field]: next || null });
    if (!result.ok) toast.error(result.error);
  }

  const remove = () =>
    startDelete(async () => {
      const result = await deleteEstimateAction(estimate.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Запит видалено.");
      router.push(section.href);
    });

  return (
    <header className="pb-5">
      <Link
        href={section.href}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-fg-2 transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {section.label}
      </Link>

      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          {editable ? (
            <>
              <h1>
                <input
                  aria-label="Клієнт"
                  value={clientName}
                  maxLength={200}
                  onChange={(e) => setClientName(e.target.value)}
                  onBlur={() => save("clientName", clientName, estimate.clientName)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  className={clsx(bareInput, "h-11 text-[28px] font-semibold tracking-tight")}
                />
              </h1>
              <input
                aria-label="Проєкт"
                value={projectName}
                maxLength={300}
                placeholder="Назва проєкту"
                onChange={(e) => setProjectName(e.target.value)}
                onBlur={() => save("projectName", projectName, estimate.projectName)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className={clsx(bareInput, "mt-0.5 h-8 text-base text-fg-2 placeholder:text-fg-muted")}
              />
            </>
          ) : (
            <>
              <h1 className="truncate text-[28px] leading-11 font-semibold tracking-tight">{estimate.clientName}</h1>
              <p className="mt-0.5 truncate text-base leading-8 text-fg-2">{estimate.projectName ?? "Без назви проєкту"}</p>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-2">
          <span className={clsx("rounded-full border px-2.5 py-0.5 text-[13px]", STATUS_TONE[estimate.status])}>
            {STATUS_LABELS[estimate.status]}
          </span>
          <Menu
            label="Дії із запитом"
            triggerLabel="Дії із запитом"
            triggerContent={<MoreHorizontal className="size-4" aria-hidden />}
            triggerClassName="flex size-9 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
            items={[
              {
                key: "delete",
                label: "Видалити запит",
                icon: <Trash2 className="size-4" aria-hidden />,
                danger: true,
                onSelect: () => setConfirmDelete(true),
              },
            ]}
          />
        </div>
      </div>

      <DateLine estimate={estimate} className="mt-3" />

      <ConfirmDialog
        open={confirmDelete}
        title="Видалити запит?"
        message={
          <>
            Запит «{estimate.clientName}» буде видалено назавжди разом з оцінкою та матеріалами. Цю дію не можна
            скасувати.
          </>
        }
        confirmLabel="Видалити"
        tone="danger"
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </header>
  );
}
