import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageScrollShell, PageStickyHeader } from "@/components/page-layout";
import { DecisionPrayerSection } from "@/components/decision-prayer-section";
import { GraceNotesSection } from "@/components/grace-notes-section";
import { SermonPointsSection } from "@/components/sermon-points-section";
import { ScrollToTopOnMount } from "@/components/scroll-to-top";
import { SubPageHeader } from "@/components/sub-page-header";
import { getSupabase, type Sermon } from "@/lib/supabase";
import { formatSermonDateLabel } from "@/lib/archive";
import { normalizeSermon } from "@/lib/sermon-parse";

export const dynamic = "force-dynamic";

export default async function SermonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await getSupabase()
    .from("sermons")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`설교 데이터를 불러오지 못했습니다: ${error.message}`);
  }

  if (!data) {
    notFound();
  }

  const raw = data as Record<string, unknown>;
  const sermon = normalizeSermon(raw);
  const sermonForDate: Sermon = {
    id: sermon.id,
    title: sermon.title,
    core_bible_verse: sermon.core_bible_verse,
    keywords: sermon.keywords,
    summary: sermon.summary,
    points: sermon.points,
    sermon_date:
      typeof raw.sermon_date === "string"
        ? raw.sermon_date
        : raw.sermon_date === null
          ? null
          : undefined,
    created_at: sermon.created_at,
  };
  const displayDateLabel = formatSermonDateLabel(sermonForDate);

  return (
    <AppShell>
      <PageScrollShell>
        <ScrollToTopOnMount />
        <PageStickyHeader>
          <SubPageHeader showTitle={false} />
        </PageStickyHeader>

        <div className="flex flex-col gap-4 pb-6">
          <div className="rounded-3xl bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-violet-600" />
              <span className="text-sm font-semibold text-violet-700">
                핵심 말씀
              </span>
            </div>
            <p className="mt-3 text-lg font-bold leading-snug text-foreground">
              {sermon.core_bible_verse}
            </p>
          </div>

          <div className="rounded-3xl bg-card p-6 shadow-sm">
            <span className="text-xs text-muted-foreground">
              {displayDateLabel}
            </span>
            <h2 className="mt-2 text-lg font-bold leading-tight text-foreground">
              {sermon.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {sermon.summary}
            </p>
          </div>

          <SermonPointsSection points={sermon.points} videoId={sermon.id} />

          <GraceNotesSection notes={sermon.grace_notes} videoId={sermon.id} />

          <DecisionPrayerSection
            prayer={sermon.decision_prayer}
            videoId={sermon.id}
          />

          {sermon.keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2 pb-2">
              {sermon.keywords.map((keyword, idx) => (
                <span
                  key={`${keyword}-${idx}`}
                  className="rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground"
                >
                  #{keyword}
                </span>
              ))}
            </div>
          ) : (
            <p className="pb-2 text-sm text-muted-foreground">
              등록된 키워드가 없습니다.
            </p>
          )}
        </div>
      </PageScrollShell>
    </AppShell>
  );
}
