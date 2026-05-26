import Link from "next/link";
import { Search, Sun, CalendarDays, ChevronRight } from "lucide-react";
import { getSupabase, type Sermon } from "@/lib/supabase";
import { pickTodaySermon } from "@/lib/today-pick";
import { AppShell } from "@/components/app-shell";
import { PageShell } from "@/components/page-layout";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { data, error } = await getSupabase()
    .from("sermons")
    .select("*")
    .order("sermon_date", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`설교 데이터를 불러오지 못했습니다: ${error.message}`);
  }

  const sermons = (data ?? []) as Sermon[];
  const todaySermon = pickTodaySermon(sermons);

  return (
    <AppShell>
      <PageShell>
        <div className="flex w-full flex-col gap-4 pb-6">
          <PageHeader
            title="오늘도 평안하세요"
            subtitle="말씀으로 하루를 시작해보세요"
          />

          <Link
            href="/search"
            className="flex h-fit w-full items-center gap-3 rounded-2xl bg-card px-5 py-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
          >
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              키워드로 검색해보세요
            </span>
          </Link>

          {todaySermon ? (
            <Link
              href={`/sermon/${todaySermon.id}`}
              className="relative block h-fit w-full rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-100 p-6 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-0.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
                  ✨ 오늘의 추천 말씀
                </span>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                  <Sun className="size-6 text-amber-500" />
                </div>
              </div>
              <h2 className="mt-3 text-lg font-bold text-foreground">
                오늘의 말씀
              </h2>
              <p className="mt-2 text-base font-semibold leading-relaxed text-foreground">
                {todaySermon.core_bible_verse}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {todaySermon.title}
              </p>
              <span className="mt-3 inline-flex rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground">
                바로가기
              </span>
            </Link>
          ) : (
            <div className="relative h-fit w-full rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-100 p-6 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-0.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
                  ✨ 오늘의 추천 말씀
                </span>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                  <Sun className="size-6 text-amber-500" />
                </div>
              </div>
              <h2 className="mt-3 text-lg font-bold text-foreground">
                오늘의 말씀
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                아직 등록된 설교가 없습니다.
              </p>
            </div>
          )}

          <Link
            href="/archive"
            className="relative block h-fit w-full rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-100 p-6 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
          >
            <div className="absolute right-6 top-6 flex size-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
              <CalendarDays className="size-6 text-emerald-600" />
            </div>

            <div className="flex flex-col items-start justify-start pr-14">
              <h2 className="text-lg font-bold text-foreground">
                날짜로 설교 찾기
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                지난 주일의 말씀도
                <br />
                언제든 다시 들을 수 있어요
              </p>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white">
                둘러보기
                <ChevronRight className="size-4" />
              </span>
            </div>
          </Link>
        </div>
      </PageShell>
    </AppShell>
  );
}
