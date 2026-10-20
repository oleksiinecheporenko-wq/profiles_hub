import Link from "next/link";
import { UserRound } from "lucide-react";
import { computeTable, costs, type Estimate } from "@/lib/domain/estimate";
import { formatCost, formatHours } from "@/lib/format";
import { DateLine } from "./DateLine";

/** One estimate in a section list; opens the estimate page. */
export function EstimateCard({ estimate }: { estimate: Estimate }) {
  const { total } = computeTable(estimate.rows);
  const cost = costs(total, estimate.rate);
  return (
    <li>
      <Link
        href={`/estimates/${estimate.id}`}
        className="flex h-full flex-col gap-3 rounded-lg border border-line bg-surface-1 p-5 transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover"
      >
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{estimate.clientName}</h2>
          <p className="truncate text-sm text-fg-2">{estimate.projectName ?? "Без назви проєкту"}</p>
        </div>
        <DateLine estimate={estimate} />
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-[13px] text-fg-2">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <UserRound className="size-3.5 shrink-0 text-fg-muted" aria-hidden />
            <span className="truncate">{estimate.developer ?? "Розробника не вказано"}</span>
          </span>
          {total.realistic > 0 && (
            <span className="font-mono">
              <span className="text-fg-muted">Realistic</span> {formatHours(total.realistic)} год
            </span>
          )}
          {cost && <span className="ml-auto font-mono font-semibold text-positive">{formatCost(cost.realistic)}</span>}
        </div>
      </Link>
    </li>
  );
}

export function EstimateGrid({ estimates }: { estimates: Estimate[] }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
      {estimates.map((e) => (
        <EstimateCard key={e.id} estimate={e} />
      ))}
    </ul>
  );
}
