import type { ReactNode } from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  message: string;
  action?: ReactNode;
  className?: string;
};

/** Small icon, one short sentence and at most one relevant action. */
export function EmptyState({ icon: Icon, message, action, className }: Props) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong px-6 py-12 text-center",
        className,
      )}
    >
      <Icon className="size-5 text-fg-muted" aria-hidden />
      <p className="text-sm text-fg-2">{message}</p>
      {action}
    </div>
  );
}
