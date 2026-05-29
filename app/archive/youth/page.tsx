import { getSupabase, type Sermon } from "@/lib/supabase";
import { sortSermonsBySermonDate } from "@/lib/archive";
import { ArchiveMonthList } from "@/components/archive-month-list";
import { AppShell } from "@/components/app-shell";
import { PageShell } from "@/components/page-layout";
import { SubPageHeader } from "@/components/sub-page-header";

export const metadata = {
  title: "청년예배 | 오늘의 말씀",
};

export const dynamic = "force-dynamic";

export default async function ArchiveYouthPage() {
  const { data, error } = await getSupabase().from("sermons").select("*");

  if (error) {
    throw new Error(`설교 데이터를 불러오지 못했습니다: ${error.message}`);
  }

  const sermons = sortSermonsBySermonDate(
    ((data ?? []) as Sermon[]).filter(
      (sermon) => (sermon.service_type ?? "").trim() === "청년",
    ),
  );

  return (
    <AppShell>
      <PageShell>
        <SubPageHeader
          title="청년예배"
          subtitle="월별로 정리된 청년 말씀을 다시 만나보세요"
          backHref="/archive"
        />

        <ArchiveMonthList
          sermons={sermons}
          emptyMessage="아직 보관된 청년 말씀이 없습니다."
          showPreacher
        />
      </PageShell>
    </AppShell>
  );
}
