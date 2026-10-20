import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("block animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none", className)}
    />
  );
}
