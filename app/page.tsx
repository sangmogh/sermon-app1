import Link from "next/link";
import { Search, Sun, CalendarDays } from "lucide-react";
import { getSupabase, type Sermon } from "@/lib/supabase";
import { pickTodaySermon } from "@/lib/today-pick";
import { AppShell } from "@/components/app-shell";
import { PageShell } from "@/components/page-layout";
import { PageHeader } from "@/components/page-header";
import { PwaInstallCard } from "@/components/pwa-install-card";

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
              고민이 있나요?
            </span>
          </Link>

          {todaySermon ? (
            <Link
              href={`/sermon/${todaySermon.id}`}
              className="relative block w-full rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-100 px-6 pt-6 pb-5 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
            >
              <div className="absolute right-6 top-4 flex size-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                <Sun className="size-6 text-amber-500" />
              </div>
              <h2 className="pr-14 text-lg font-bold text-foreground">
                오늘의 말씀
              </h2>
              <p className="mt-2 text-base font-semibold leading-relaxed text-foreground">
                {todaySermon.core_bible_verse}
              </p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <p className="min-w-0 flex-1 text-sm leading-snug text-muted-foreground">
                  {todaySermon.title}
                </p>
                <span className="shrink-0 inline-flex rounded-full bg-primary px-4 py-1.5 text-sm font-semibold leading-none text-primary-foreground">
                  바로가기
                </span>
              </div>
            </Link>
          ) : (
            <div className="relative w-full rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-100 px-6 pt-6 pb-5 shadow-sm">
              <div className="absolute right-6 top-4 flex size-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
                <Sun className="size-6 text-amber-500" />
              </div>
              <h2 className="pr-14 text-lg font-bold text-foreground">
                오늘의 말씀
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                아직 등록된 설교가 없습니다.
              </p>
            </div>
          )}

          <Link
            href="/archive"
            className="relative block w-full rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-100 p-6 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
          >
            <div className="absolute right-6 top-4 flex size-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
              <CalendarDays className="size-6 text-emerald-600" />
            </div>

            <h2 className="pr-14 text-lg font-bold text-foreground">
              날짜로 설교 찾기
            </h2>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-0 text-sm leading-snug text-muted-foreground">
                <p>지난 주일의 말씀도</p>
                <p>언제든 다시 들을 수 있어요</p>
              </div>
              <span className="shrink-0 inline-flex rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold leading-none text-white">
                둘러보기
              </span>
            </div>
          </Link>

          <PwaInstallCard />
        </div>
      </PageShell>
    </AppShell>
  );
}
