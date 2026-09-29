import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("block animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none", className)}
    />
  );
}

/** Placeholder rows for list/table screens. */
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Завантаження" className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-3 px-3">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="ml-6 h-3.5 flex-1" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      ))}
    </div>
  );
}
