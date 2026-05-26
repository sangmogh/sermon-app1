type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-muted/70 ${className}`.trim()}
      aria-hidden
    />
  );
}

export function SermonDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-32 w-full rounded-3xl" />
      <Skeleton className="h-40 w-full rounded-3xl" />
      <div className="rounded-3xl bg-card p-6 shadow-sm">
        <Skeleton className="mb-4 h-4 w-24" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
      <Skeleton className="h-36 w-full rounded-3xl" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-16 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-14 rounded-full" />
      </div>
    </div>
  );
}

export function SearchResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
    </div>
  );
}

export function ArchiveListSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Skeleton className="mb-3 h-4 w-28" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[88px] w-full rounded-2xl" />
          <Skeleton className="h-[88px] w-full rounded-2xl" />
        </div>
      </div>
      <div>
        <Skeleton className="mb-3 h-4 w-28" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[88px] w-full rounded-2xl" />
          <Skeleton className="h-[88px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
