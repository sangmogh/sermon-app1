import { createBrowserSupabase } from "@/lib/supabase-browser";
import { formatSermonDateLabel, sortSermonsBySermonDate } from "@/lib/archive";
import { parseKeywords } from "@/lib/sermon-parse";
import { isMainSermon } from "@/lib/service-type";
import type { Sermon } from "@/lib/supabase";

export type SearchResultSermon = {
  id: string;
  title: string;
  core_bible_verse: string;
  keywords: string[];
  summary?: string;
  sermon_date?: string | null;
  /** 설교자 이름 — 결과 카드에 'OOO 목사' 라벨로 표시 (있을 때만) */
  preacher?: string | null;
  /** 예배 종류 — 태그 검색 필터링 전용, UI에 표시하지 않음 */
  service_type?: string | null;
  /** 고민(임베딩) 검색에서 이 설교를 끌어올린 포인트 제목 (요약 매칭이면 없음) */
  matchedPointTitle?: string;
};

export const POPULAR_TAGS = ["위로", "결단", "가족", "사명", "믿음"] as const;

const SERMON_SELECT =
  "id, title, core_bible_verse, keywords, sermon_date, preacher, service_type, created_at";

/** PostgREST ilike 와일드카드 이스케이프 */
export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}

function normalizeRow(row: Record<string, unknown>): SearchResultSermon {
  const sermonDate = row.sermon_date;
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? "제목 없음"),
    core_bible_verse: String(row.core_bible_verse ?? ""),
    keywords: parseKeywords(row.keywords),
    sermon_date:
      typeof sermonDate === "string"
        ? sermonDate
        : sermonDate === null
          ? null
          : undefined,
    preacher: typeof row.preacher === "string" ? row.preacher : null,
    service_type: typeof row.service_type === "string" ? row.service_type : null,
  };
}

function rowToSermon(row: SearchResultSermon): Sermon {
  return {
    id: row.id,
    title: row.title,
    core_bible_verse: row.core_bible_verse,
    keywords: row.keywords,
    summary: "",
    points: [],
    sermon_date: row.sermon_date ?? null,
    preacher: row.preacher ?? null,
    created_at: "",
  };
}

function mergeUniqueResults(
  lists: SearchResultSermon[][],
): SearchResultSermon[] {
  const map = new Map<string, SearchResultSermon>();
  for (const list of lists) {
    for (const item of list) {
      if (item.id && isMainSermon(item.service_type ?? null)) {
        map.set(item.id, item);
      }
    }
  }

  const asSermons = Array.from(map.values()).map(rowToSermon);
  const sorted = sortSermonsBySermonDate(asSermons);

  return sorted.map((sermon) => ({
    id: sermon.id,
    title: sermon.title,
    core_bible_verse: sermon.core_bible_verse,
    keywords: sermon.keywords,
    sermon_date: sermon.sermon_date,
    preacher: sermon.preacher ?? null,
  }));
}

/**
 * title ilike + keywords(jsonb) 부분 일치 검색
 */
export async function searchSermons(
  query: string,
): Promise<SearchResultSermon[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const supabase = createBrowserSupabase();
  const pattern = `%${escapeIlikePattern(trimmed)}%`;
  const tag = trimmed.replace(/^#/, "");

  const { data: titleMatches, error: titleError } = await supabase
    .from("sermons")
    .select(SERMON_SELECT)
    .ilike("title", pattern);

  if (titleError) {
    throw new Error(titleError.message);
  }

  const titleResults = (titleMatches ?? []).map((row) =>
    normalizeRow(row as Record<string, unknown>),
  );

  const { data: keywordTextMatches, error: keywordTextError } = await supabase
    .from("sermons")
    .select(SERMON_SELECT)
    .ilike("keywords", pattern);

  let keywordResults: SearchResultSermon[] = [];

  if (!keywordTextError && keywordTextMatches) {
    keywordResults = keywordTextMatches.map((row) =>
      normalizeRow(row as Record<string, unknown>),
    );
  } else {
    const { data: allSermons, error: allError } = await supabase
      .from("sermons")
      .select(SERMON_SELECT);

    if (allError) {
      throw new Error(allError.message);
    }

    const lower = trimmed.toLowerCase();
    keywordResults = (allSermons ?? [])
      .map((row) => normalizeRow(row as Record<string, unknown>))
      .filter((sermon) =>
        sermon.keywords.some((keyword) =>
          keyword.toLowerCase().includes(lower),
        ),
      );
  }

  const { data: allSermons, error: allError } = await supabase
    .from("sermons")
    .select(SERMON_SELECT);

  let tagResults: SearchResultSermon[] = [];
  if (!allError && allSermons) {
    tagResults = allSermons
      .map((row) => normalizeRow(row as Record<string, unknown>))
      .filter((sermon) => sermon.keywords.includes(tag));
  }

  return mergeUniqueResults([titleResults, keywordResults, tagResults]);
}

export function formatSearchResultDate(sermon: SearchResultSermon): string {
  return formatSermonDateLabel(rowToSermon(sermon));
}
