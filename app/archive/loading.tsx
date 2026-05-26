import { AppShell } from "@/components/app-shell";
import { PageShell } from "@/components/page-layout";
import { SubPageHeader } from "@/components/sub-page-header";

function YearGridSkeleton() {
  return (
    <div className="grid w-full grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="aspect-square w-full animate-pulse rounded-3xl bg-muted"
        />
      ))}
    </div>
  );
}

export default function ArchiveLoading() {
  return (
    <AppShell wide>
      <PageShell className="!px-4 sm:!px-5">
        <SubPageHeader
          title="설교 보관함"
          subtitle="연도를 선택해 지난 말씀을 만나보세요"
        />
        <YearGridSkeleton />
      </PageShell>
    </AppShell>
  );
}
