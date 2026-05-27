import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PageShell } from "@/components/page-layout";
import { SubPageHeader } from "@/components/sub-page-header";
import { SearchClient } from "@/app/search/search-client";
import { getSupabase } from "@/lib/supabase";
import { computeSearchPopularKeywords } from "@/lib/keyword-stats";

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
  const topKeywords = computeSearchPopularKeywords(rows, 10);

  return (
    <AppShell>
      <PageShell>
        <SubPageHeader showTitle={false} />
        <Suspense fallback={null}>
          <SearchClient topKeywords={topKeywords} />
        </Suspense>
      </PageShell>
    </AppShell>
  );
}
