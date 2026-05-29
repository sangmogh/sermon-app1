import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { getSupabase, type Sermon } from "@/lib/supabase";
import { collectArchiveYears } from "@/lib/archive";
import { isMainSermon } from "@/lib/service-type";
import { AppShell } from "@/components/app-shell";
import { PageShell } from "@/components/page-layout";
import { SubPageHeader } from "@/components/sub-page-header";

export const metadata = {
  title: "설교 보관함 | 오늘의 말씀",
};

export const dynamic = "force-dynamic";

export default async function ArchiveYearPickerPage() {
  const { data, error } = await getSupabase()
    .from("sermons")
    .select("sermon_date, service_type");

  if (error) {
    throw new Error(`설교 데이터를 불러오지 못했습니다: ${error.message}`);
  }

  // 연도 카드는 주일 설교만 — 새벽·청년은 아래 전용 카드로 따로 모은다
  const mainSermons = ((data ?? []) as Sermon[]).filter((sermon) =>
    isMainSermon(sermon.service_type),
  );
  const years = collectArchiveYears(mainSermons);

  // 하단 고정 카드: 연도와 동일한 UI, 라벨만 예배 종류
  const serviceCards = [
    { label: "새벽기도회", href: "/archive/dawn" },
    { label: "청년예배", href: "/archive/youth" },
  ];

  return (
    <AppShell>
      <PageShell>
        <SubPageHeader
          title="설교 보관함"
          subtitle="연도를 선택해 지난 말씀을 만나보세요"
        />

        <div className="grid w-full grid-cols-2 gap-3 pb-6">
          {years.map((year) => (
            <Link
              key={year}
              href={`/archive/${year}`}
              className="flex aspect-[5/4] w-full flex-col items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 p-4 text-center shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-white/80 shadow-sm">
                <CalendarDays className="size-6 text-emerald-600" strokeWidth={2} />
              </div>
              <span className="text-[1.375rem] font-bold leading-none tracking-tight text-foreground">
                {year}년
              </span>
            </Link>
          ))}
          {serviceCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="flex aspect-[5/4] w-full flex-col items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 p-4 text-center shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-white/80 shadow-sm">
                <CalendarDays className="size-6 text-emerald-600" strokeWidth={2} />
              </div>
              <span className="text-[1.375rem] font-bold leading-none tracking-tight text-foreground">
                {card.label}
              </span>
            </Link>
          ))}
        </div>
      </PageShell>
    </AppShell>
  );
}
