import clsx from "clsx";
import {
  CONTRACT_STATUS_LABELS,
  PROFILE_STATUS_LABELS,
  type ContractStatus,
  type ProfileStatus,
} from "@/lib/domain/enums";

const badgeBase =
  "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[5px] border px-2 text-xs font-medium whitespace-nowrap";

/** Semantic colors per profile status: Active green, Hold amber, Ban red, Back to Developer coral. */
export const PROFILE_STATUS_TONE: Record<ProfileStatus, { text: string; dot: string; soft: string; edge: string }> = {
  active: { text: "text-positive", dot: "bg-positive", soft: "bg-positive-soft", edge: "border-l-positive" },
  hold: { text: "text-warning", dot: "bg-warning", soft: "bg-warning-soft", edge: "border-l-warning" },
  ban: { text: "text-negative", dot: "bg-negative", soft: "bg-negative-soft", edge: "border-l-negative" },
  back_to_developer: { text: "text-accent", dot: "bg-accent", soft: "bg-accent-soft", edge: "border-l-accent" },
};

export function ProfileStatusBadge({ status, className }: { status: ProfileStatus; className?: string }) {
  const tone = PROFILE_STATUS_TONE[status];
  return (
    <span className={clsx(badgeBase, "border-line", tone.soft, tone.text, className)}>
      <span className={clsx("size-1.5 rounded-full", tone.dot)} aria-hidden />
      {PROFILE_STATUS_LABELS[status]}
    </span>
  );
}

/** Contract badges use their own treatment so they never read as profile statuses. */
export function ContractStatusBadge({ status, className }: { status: ContractStatus; className?: string }) {
  return (
    <span
      className={clsx(
        badgeBase,
        "font-mono uppercase tracking-wide",
        status === "active"
          ? "border-positive/35 text-positive"
          : "border-line-strong text-fg-muted",
        className,
      )}
    >
      {CONTRACT_STATUS_LABELS[status]}
    </span>
  );
}

/** Marks a global version as current (coral) or archived (neutral). */
export function VersionBadge({ current, className }: { current: boolean; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex h-5 items-center rounded-sm px-1.5 font-mono text-[11px] tracking-wide uppercase",
        current ? "bg-accent-soft text-accent" : "bg-neutral-soft text-fg-muted",
        className,
      )}
    >
      {current ? "актуальна" : "архів"}
    </span>
  );
}
