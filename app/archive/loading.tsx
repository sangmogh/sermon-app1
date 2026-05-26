import { AppShell } from "@/components/app-shell";
import { PageShell } from "@/components/page-layout";
import { SubPageHeader } from "@/components/sub-page-header";

function YearGridSkeleton() {
  return (
    <div className="grid w-full grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="aspect-[5/4] w-full animate-pulse rounded-2xl bg-muted"
        />
      ))}
    </div>
  );
}

export default function ArchiveLoading() {
  return (
    <AppShell>
      <PageShell>
        <SubPageHeader
          title="설교 보관함"
          subtitle="연도를 선택해 지난 말씀을 만나보세요"
        />
        <YearGridSkeleton />
      </PageShell>
    </AppShell>
  );
}
