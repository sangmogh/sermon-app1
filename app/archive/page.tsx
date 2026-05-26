import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { getSupabase, type Sermon } from "@/lib/supabase";
import { collectArchiveYears } from "@/lib/archive";
import { AppShell } from "@/components/app-shell";
import { PageShell } from "@/components/page-layout";
import { SubPageHeader } from "@/components/sub-page-header";

export const metadata = {
  title: "설교 보관함 | 오늘의 말씀",
};

export const dynamic = "force-dynamic";

export default async function ArchiveYearPickerPage() {
  const { data, error } = await getSupabase().from("sermons").select("sermon_date");

  if (error) {
    throw new Error(`설교 데이터를 불러오지 못했습니다: ${error.message}`);
  }

  const years = collectArchiveYears((data ?? []) as Sermon[]);

  return (
    <AppShell>
      <PageShell>
        <SubPageHeader
          title="설교 보관함"
          subtitle="연도를 선택해 지난 말씀을 만나보세요"
        />

        {years.length === 0 ? (
          <div className="rounded-2xl bg-card p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              아직 날짜가 등록된 설교가 없습니다.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-6">
            {years.map((year) => (
              <Link
                key={year}
                href={`/archive/${year}`}
                className="flex aspect-[5/4] flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 p-4 text-center shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-white/80 shadow-sm">
                  <CalendarDays className="size-6 text-emerald-600" />
                </div>
                <span className="text-lg font-bold text-foreground">
                  {year}년
                </span>
              </Link>
            ))}
          </div>
        )}
      </PageShell>
    </AppShell>
  );
}
