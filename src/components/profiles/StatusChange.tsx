"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { changeStatusAction } from "@/app/(app)/profiles/[id]/actions";
import { PROFILE_STATUS_TONE, ProfileStatusBadge } from "@/components/ui/Badges";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Field, Textarea } from "@/components/ui/Input";
import { Menu } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { PROFILE_STATUSES, PROFILE_STATUS_LABELS, type ProfileStatus } from "@/lib/domain/enums";

type Target = { id: string; fullName: string; status: ProfileStatus };

/**
 * Confirmation for a status change with the optional `Причина`.
 * The change is applied only after confirmation; cancel changes nothing.
 */
export function StatusChangeDialog({
  profile,
  target,
  onClose,
  onChanged,
}: {
  profile: Target;
  target: ProfileStatus | null;
  onClose: () => void;
  onChanged?: (status: ProfileStatus) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const close = () => {
    if (pending) return;
    setReason("");
    onClose();
  };

  const confirm = () => {
    if (!target) return;
    startTransition(async () => {
      const result = await changeStatusAction(profile.id, { status: target, reason: reason.trim() || null });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Статус змінено на ${PROFILE_STATUS_LABELS[target]}.`);
      setReason("");
      onChanged?.(target);
      onClose();
      router.refresh();
    });
  };

  return (
    <ConfirmDialog
      open={target !== null}
      title="Змінити статус профілю?"
      confirmLabel="Змінити статус"
      loading={pending}
      onConfirm={confirm}
      onCancel={close}
      message={
        target && (
          <div className="flex flex-col gap-3">
            <p>
              Профіль <span className="font-medium text-fg">«{profile.fullName}»</span>
            </p>
            <div className="flex items-center gap-2">
              <ProfileStatusBadge status={profile.status} />
              <span className="text-fg-muted" aria-hidden>
                →
              </span>
              <span className="sr-only">буде змінено на</span>
              <ProfileStatusBadge status={target} />
            </div>
          </div>
        )
      }
    >
      <Field label="Причина" hint="Необов’язково. Буде збережено в журналі дій.">
        {(p) => (
          <Textarea
            {...p}
            data-autofocus
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                confirm();
              }
            }}
          />
        )}
      </Field>
    </ConfirmDialog>
  );
}

/** Interactive status badge: opens a menu of the other statuses, then the confirmation. */
export function StatusBadgeMenu({ profile, size = "md" }: { profile: Target; size?: "sm" | "md" }) {
  const [target, setTarget] = useState<ProfileStatus | null>(null);
  const tone = PROFILE_STATUS_TONE[profile.status];

  return (
    <>
      <Menu
        label="Змінити статус"
        items={PROFILE_STATUSES.filter((s) => s !== profile.status).map((s) => ({
          key: s,
          label: PROFILE_STATUS_LABELS[s],
          icon: <span className={clsx("size-2 rounded-full", PROFILE_STATUS_TONE[s].dot)} aria-hidden />,
          onSelect: () => setTarget(s),
        }))}
        triggerLabel={`Статус: ${PROFILE_STATUS_LABELS[profile.status]}. Змінити`}
        triggerClassName={clsx(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-2.5 font-medium transition-colors",
          "hover:border-line-strong",
          tone.soft,
          tone.text,
          size === "sm" ? "h-6 text-xs" : "h-8 text-[13px]",
        )}
        triggerContent={
          <>
            <span className={clsx("size-1.5 rounded-full", tone.dot)} aria-hidden />
            {PROFILE_STATUS_LABELS[profile.status]}
            <ChevronDown className="size-3.5 opacity-70" aria-hidden />
          </>
        }
      />
      <StatusChangeDialog profile={profile} target={target} onClose={() => setTarget(null)} />
    </>
  );
}
