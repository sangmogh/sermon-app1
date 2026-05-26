import { AppShell } from "@/components/app-shell";
import { PageShell } from "@/components/page-layout";
import { SubPageHeader } from "@/components/sub-page-header";
import { ArchiveListSkeleton } from "@/components/skeleton";

export default function ArchiveYearLoading() {
  return (
    <AppShell>
      <PageShell>
        <SubPageHeader
          title="설교 보관함"
          subtitle="월별로 정리된 지난 말씀을 다시 만나보세요"
          backHref="/archive"
        />
        <ArchiveListSkeleton />
      </PageShell>
    </AppShell>
  );
}
