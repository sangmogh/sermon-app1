import { AppShell } from "@/components/app-shell";
import { PageScrollShell, PageStickyHeader } from "@/components/page-layout";
import { SubPageHeader } from "@/components/sub-page-header";
import { SermonDetailSkeleton } from "@/components/skeleton";

export default function SermonDetailLoading() {
  return (
    <AppShell>
      <PageScrollShell>
        <PageStickyHeader>
          <SubPageHeader title="오늘의 말씀" />
        </PageStickyHeader>
        <SermonDetailSkeleton />
      </PageScrollShell>
    </AppShell>
  );
}
