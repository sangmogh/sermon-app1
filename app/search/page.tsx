import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PageShell } from "@/components/page-layout";
import { SubPageHeader } from "@/components/sub-page-header";
import { SearchClient } from "@/app/search/search-client";
import { getSupabase } from "@/lib/supabase";
import { computeAllKeywords, computeTopKeywords } from "@/lib/keyword-stats";

export const metadata = {
  title: "검색 | 오늘의 말씀",
};

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const { data, error } = await getSupabase().from("sermons").select("keywords");

  if (error) {
    throw new Error(`키워드를 불러오지 못했습니다: ${error.message}`);
  }

  const rows = data ?? [];
  const topKeywords = computeTopKeywords(rows, 10);
  const allKeywords = computeAllKeywords(rows);

  return (
    <AppShell>
      <PageShell>
        <SubPageHeader title="검색" subtitle="제목·키워드로 설교를 찾아보세요" />
        <Suspense fallback={null}>
          <SearchClient topKeywords={topKeywords} allKeywords={allKeywords} />
        </Suspense>
      </PageShell>
    </AppShell>
  );
}
