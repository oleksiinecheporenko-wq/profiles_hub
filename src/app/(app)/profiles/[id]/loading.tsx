import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div role="status" aria-label="Завантаження">
      <Skeleton className="mb-4 h-3.5 w-20" />
      <div className="flex items-center gap-4 pb-6">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-3.5 w-96" />
        </div>
      </div>
      <Skeleton className="h-11 w-full" />
      <div className="grid grid-cols-[62fr_38fr] gap-8 pt-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
