import { Search, Sun, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageShell } from "@/components/page-layout";
import { PageHeader } from "@/components/page-header";

export default function HomeLoading() {
  return (
    <AppShell>
      <PageShell>
        <div className="flex w-full flex-col gap-4 pb-6">
          <PageHeader
            title="오늘도 평안하세요"
            subtitle="말씀으로 하루를 시작해보세요"
          />

          <div className="flex h-fit w-full items-center gap-3 rounded-2xl bg-card px-5 py-4 shadow-sm">
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              고민을 입력해보세요
            </span>
          </div>

          <div className="relative w-full rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-100 px-6 pt-6 pb-5 shadow-sm">
            <div className="absolute right-6 top-4 flex size-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
              <Sun className="size-6 text-amber-500" />
            </div>
            <h2 className="pr-14 text-lg font-bold text-foreground">
              오늘의 말씀
            </h2>
            <div className="mt-3 h-4 w-2/5 animate-pulse rounded-full bg-white/70" />
            <div className="mt-3 h-3 w-3/4 animate-pulse rounded-full bg-white/60" />
          </div>

          <div className="relative w-full rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-100 p-6 shadow-sm">
            <div className="absolute right-6 top-4 flex size-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
              <CalendarDays className="size-6 text-emerald-600" />
            </div>
            <h2 className="pr-14 text-lg font-bold text-foreground">
              날짜로 설교 찾기
            </h2>
            <div className="mt-3 space-y-2">
              <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/60" />
              <div className="h-3 w-1/2 animate-pulse rounded-full bg-white/60" />
            </div>
          </div>
        </div>
      </PageShell>
    </AppShell>
  );
}
