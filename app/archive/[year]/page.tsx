import { notFound } from "next/navigation";
import { getSupabase, type Sermon } from "@/lib/supabase";
import {
  collectArchiveYears,
  filterSermonsByYear,
  sortSermonsBySermonDate,
} from "@/lib/archive";
import { ArchiveMonthList } from "@/components/archive-month-list";
import { AppShell } from "@/components/app-shell";
import { PageShell } from "@/components/page-layout";
import { SubPageHeader } from "@/components/sub-page-header";

export const dynamic = "force-dynamic";

type ArchiveYearPageProps = {
  params: Promise<{ year: string }>;
};

export async function generateMetadata({ params }: ArchiveYearPageProps) {
  const { year } = await params;
  return {
    title: `${year}년 설교 | 오늘의 말씀`,
  };
}

export default async function ArchiveYearPage({ params }: ArchiveYearPageProps) {
  const { year: yearParam } = await params;
  const year = Number.parseInt(yearParam, 10);

  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    notFound();
  }

  const { data, error } = await getSupabase().from("sermons").select("*");

  if (error) {
    throw new Error(`설교 데이터를 불러오지 못했습니다: ${error.message}`);
  }

  const allSermons = (data ?? []) as Sermon[];
  const availableYears = collectArchiveYears(allSermons);

  if (!availableYears.includes(year)) {
    notFound();
  }

  const sermons = sortSermonsBySermonDate(filterSermonsByYear(allSermons, year));

  return (
    <AppShell>
      <PageShell>
        <SubPageHeader
          title={`${year}년 설교`}
          subtitle="월별로 정리된 지난 말씀을 다시 만나보세요"
          backHref="/archive"
        />

        <ArchiveMonthList sermons={sermons} />
      </PageShell>
    </AppShell>
  );
}
