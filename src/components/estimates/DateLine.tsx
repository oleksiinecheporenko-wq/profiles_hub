import clsx from "clsx";
import { CalendarPlus, CircleCheck, Timer } from "lucide-react";
import { durationHours, type Estimate } from "@/lib/domain/estimate";
import { formatDateTime, formatHours } from "@/lib/format";

/** Creation, ready time and hours spent, on one line. */
export function DateLine({
  estimate,
  className,
}: {
  estimate: Pick<Estimate, "createdAt" | "readyAt">;
  className?: string;
}) {
  const spent = durationHours(estimate.createdAt, estimate.readyAt);
  return (
    <p className={clsx("flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px] text-fg-2", className)}>
      <span className="inline-flex items-center gap-1.5" title="Дата і час створення">
        <CalendarPlus className="size-3.5 text-fg-muted" aria-hidden />
        <span className="text-fg-muted">Створено</span> {formatDateTime(estimate.createdAt)}
      </span>
      <span className="inline-flex items-center gap-1.5" title="Дата і час готовності">
        <CircleCheck className="size-3.5 text-fg-muted" aria-hidden />
        <span className="text-fg-muted">Готово</span> {estimate.readyAt ? formatDateTime(estimate.readyAt) : "—"}
      </span>
      <span className="inline-flex items-center gap-1.5" title="Скільки часу робився естімейт">
        <Timer className="size-3.5 text-fg-muted" aria-hidden />
        {spent === null ? <span className="text-fg-muted">в роботі</span> : `${formatHours(spent)} год`}
      </span>
    </p>
  );
}
