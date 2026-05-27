import { cosineSimilarity, embedText } from "@/lib/gemini-embedding";
import { parseKeywords } from "@/lib/sermon-parse";
import { loadSermonEmbeddingIndex } from "@/lib/sermon-embedding-index";
import {
  STANDARD_KEYWORD_SET,
  STANDARD_KEYWORDS,
} from "@/lib/standard-keywords";
import { getSupabase } from "@/lib/supabase";
import type { SearchResultSermon } from "@/lib/search";

/** 임베딩 검색 상위 N (고민 문장) */
const EMBEDDING_TOP_K = 20;
/** 이보다 낮으면 제외 (노이즈 컷) */
const EMBEDDING_MIN_SCORE = 0.2;

const SERMON_SELECT =
  "id, title, core_bible_verse, keywords, summary, sermon_date, created_at";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

/** Gemini 1~5순위 태그가 설교 keywords에 맞을 때 순위 가산 (① 겹침 개수 다음) */
const TAG_RANK_BONUS = [32, 24, 18, 12, 8];

export type TagScoreEntry = { tag: string; score: number };
export type TagScores = Record<string, number>;

function normalizeRow(row: Record<string, unknown>): SearchResultSermon {
  const sermonDate = row.sermon_date;
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? "제목 없음"),
    core_bible_verse: String(row.core_bible_verse ?? ""),
    keywords: parseKeywords(row.keywords),
    summary: String(row.summary ?? "").trim() || undefined,
    sermon_date:
      typeof sermonDate === "string"
        ? sermonDate
        : sermonDate === null
          ? null
          : undefined,
  };
}

export function tagScoresToSortedList(
  scores: TagScores,
  limit = 8,
): TagScoreEntry[] {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, score]) => ({ tag, score }));
}

/** UI·호환용: 1순위=100, 이후 순위마다 감소 */
export function primaryTagsToTagScores(tags: string[]): TagScores {
  const scores: TagScores = {};
  tags.forEach((tag, index) => {
    scores[tag] = Math.max(60, 100 - index * 8);
  });
  return scores;
}

export type SermonTagMatch = {
  overlapCount: number;
  rankBonus: number;
  matchedTags: string[];
};

/** 설교 keywords ↔ Gemini가 고른 핵심 태그 교집합 */
export function sermonTagMatchScore(
  sermon: SearchResultSermon,
  primaryTags: string[],
): SermonTagMatch {
  const keywordSet = new Set(sermon.keywords);
  const matchedTags: string[] = [];
  let rankBonus = 0;

  for (let i = 0; i < primaryTags.length; i++) {
    const tag = primaryTags[i];
    if (!keywordSet.has(tag)) {
      continue;
    }
    matchedTags.push(tag);
    rankBonus += TAG_RANK_BONUS[i] ?? 6;
  }

  return {
    overlapCount: matchedTags.length,
    rankBonus,
    matchedTags,
  };
}

/**
 * 순위: ① 겹친 태그 개수 → ② 1순위·2순위… 맞춤 가산 → ③ 설교 날짜
 */
export function rankSermonsByPrimaryTags(
  sermons: SearchResultSermon[],
  primaryTags: string[],
): SearchResultSermon[] {
  if (primaryTags.length === 0) {
    return [];
  }

  const ranked = sermons
    .map((sermon) => ({
      sermon,
      ...sermonTagMatchScore(sermon, primaryTags),
    }))
    .filter((row) => row.overlapCount >= 1);

  ranked.sort((a, b) => {
    if (b.overlapCount !== a.overlapCount) {
      return b.overlapCount - a.overlapCount;
    }
    if (b.rankBonus !== a.rankBonus) {
      return b.rankBonus - a.rankBonus;
    }
    const da = a.sermon.sermon_date ?? "";
    const db = b.sermon.sermon_date ?? "";
    return db.localeCompare(da);
  });

  return ranked.map((row) => row.sermon);
}

/** @deprecated primaryTags 기반 검색 사용 */
export function rankSermonsByTagScores(
  sermons: SearchResultSermon[],
  tagScores: TagScores,
): SearchResultSermon[] {
  const primaryTags = tagScoresToSortedList(tagScores, 5).map((entry) => entry.tag);
  return rankSermonsByPrimaryTags(sermons, primaryTags);
}

export async function fetchAllSearchSermons(): Promise<SearchResultSermon[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("sermons").select(SERMON_SELECT);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) =>
    normalizeRow(row as Record<string, unknown>),
  );
}

function hasGeminiApiKey(): boolean {
  return Boolean(
    (
      process.env.GEMINI_API_KEY ??
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ??
      ""
    ).trim(),
  );
}

function readGeminiApiKey(): string {
  const key = (
    process.env.GEMINI_API_KEY ??
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ??
    ""
  ).trim();
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았습니다. .env.local 또는 Vercel 환경 변수에 추가해 주세요.",
    );
  }
  return key;
}

function readGeminiModel(): string {
  return (process.env.GEMINI_MODEL ?? "").trim() || DEFAULT_GEMINI_MODEL;
}

function normalizePrimaryTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const item of raw) {
    if (typeof item !== "string") {
      continue;
    }
    const tag = item.trim();
    if (!tag || !STANDARD_KEYWORD_SET.has(tag) || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 5) {
      break;
    }
  }

  return tags;
}

function parsePrimaryTagsFromGeminiText(text: string): string[] | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch ? jsonMatch[0] : trimmed;

  try {
    const parsed = JSON.parse(candidate) as {
      primary_tags?: unknown;
      scores?: unknown;
    };

    const fromPrimary = normalizePrimaryTags(parsed.primary_tags);
    if (fromPrimary.length > 0) {
      return fromPrimary;
    }

    if (parsed.scores && typeof parsed.scores === "object") {
      const scores: TagScores = {};
      for (const [key, val] of Object.entries(
        parsed.scores as Record<string, unknown>,
      )) {
        if (typeof val === "number" && STANDARD_KEYWORD_SET.has(key.trim())) {
          scores[key.trim()] = val;
        }
      }
      const fallback = tagScoresToSortedList(scores, 5).map((entry) => entry.tag);
      return fallback.length > 0 ? fallback : null;
    }

    return null;
  } catch {
    return null;
  }
}

/** 고민 문장 → Gemini가 고른 핵심 표준 태그 3~5개 (중요도 순) */
export async function pickConcernPrimaryTags(concern: string): Promise<string[]> {
  const trimmed = concern.trim();
  if (!trimmed) {
    return [];
  }

  const exact = trimmed.replace(/^#/, "");
  if (STANDARD_KEYWORD_SET.has(exact)) {
    return [exact];
  }

  const apiKey = readGeminiApiKey();
  const model = readGeminiModel();
  const listText = STANDARD_KEYWORDS.join(", ");

  const prompt = `당신은 교회 설교 검색 도우미입니다.
사용자 고민·상황을 읽고, 설교 DB의 keywords(표준 태그 6~10개)와 맞출 **핵심 태그만** 3~5개 고르세요.
앞쪽일수록 더 중요합니다. 목록에 없는 단어는 넣지 마세요.

[고르는 방법]
1. 사용자 문장의 핵심 주제를 떠올리세요 (가족 갈등이면: 갈등·가정·부모·관계·순종 등).
2. 표준 키워드 목록에서만 3~5개를 **중요도 순**으로 나열하세요.
3. 말씀·믿음·기도 등은 질문의 **직접 주제가 아니면 넣지 마세요**.

[예시]
입력: "가족간의 갈등이 있어요"
출력: {"primary_tags":["갈등","가정","부모·효도","관계","순종"]}

입력: "구원의 확신이 없어요"
출력: {"primary_tags":["구원 확신","구원","의심","믿음"]}

입력: "믿음을 키우는 법"
출력: {"primary_tags":["믿음","성장","말씀","기도"]}

표준 키워드 목록:
${listText}

사용자 입력: "${trimmed}"

반드시 JSON만 출력:
{"primary_tags":["1순위태그","2순위태그",...]}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Gemini API 오류 (${response.status}): ${detail.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text =
    payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const tags = parsePrimaryTagsFromGeminiText(text);

  if (!tags || tags.length === 0) {
    throw new Error("고민에 맞는 핵심 키워드를 고르지 못했습니다.");
  }

  return tags;
}

/** UI용 점수 목록 (pickConcernPrimaryTags 결과를 점수 형태로) */
export async function scoreConcernTags(concern: string): Promise<TagScores> {
  const tags = await pickConcernPrimaryTags(concern);
  return primaryTagsToTagScores(tags);
}

export type ConcernSearchResponse = {
  results: SearchResultSermon[];
  /** Gemini가 고른 핵심 태그 (1순위→, UI용 의사 점수) */
  tagScores: TagScoreEntry[];
  /** 선택된 핵심 태그 (중요도 순) */
  primaryTags: string[];
  query: string;
};

/** Gemini 키 없을 때 제목·요약·키워드 단순 매칭 (배포 환경 폴백) */
function searchSermonsBySimpleTextMatch(
  query: string,
  all: SearchResultSermon[],
): SearchResultSermon[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);

  return all
    .map((sermon) => {
      const haystack = [
        sermon.title,
        sermon.summary ?? "",
        sermon.core_bible_verse,
        ...sermon.keywords,
      ]
        .join(" ")
        .toLowerCase();

      let score = 0;
      if (haystack.includes(normalized)) {
        score += 10;
      }
      for (const token of tokens) {
        if (haystack.includes(token)) {
          score += 1;
        }
      }

      return { sermon, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const da = a.sermon.sermon_date ?? "";
      const db = b.sermon.sermon_date ?? "";
      return db.localeCompare(da);
    })
    .slice(0, EMBEDDING_TOP_K)
    .map((row) => row.sermon);
}

async function searchSermonsByEmbedding(
  query: string,
  all: SearchResultSermon[],
): Promise<SearchResultSermon[] | null> {
  const index = await loadSermonEmbeddingIndex();
  if (!index?.entries.length) {
    return null;
  }

  const byId = new Map(all.map((sermon) => [sermon.id, sermon]));
  const queryVector = await embedText(query);

  const ranked = index.entries
    .map((entry) => ({
      id: entry.id,
      score: cosineSimilarity(queryVector, entry.embedding),
    }))
    .filter((row) => byId.has(row.id) && row.score >= EMBEDDING_MIN_SCORE)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const da = byId.get(a.id)?.sermon_date ?? "";
      const db = byId.get(b.id)?.sermon_date ?? "";
      return db.localeCompare(da);
    })
    .slice(0, EMBEDDING_TOP_K);

  if (ranked.length === 0) {
    return [];
  }

  return ranked
    .map((row) => byId.get(row.id))
    .filter((sermon): sermon is SearchResultSermon => sermon !== undefined);
}

/** @deprecated 태그 교집합 폴백 — 임베딩 인덱스 없을 때만 */
async function searchSermonsByConcernTags(
  trimmed: string,
  all: SearchResultSermon[],
): Promise<ConcernSearchResponse> {
  const primaryTags = await pickConcernPrimaryTags(trimmed);
  const results = rankSermonsByPrimaryTags(all, primaryTags);
  const tagScores = primaryTagsToTagScores(primaryTags);

  return {
    results,
    tagScores: tagScoresToSortedList(tagScores),
    primaryTags,
    query: trimmed,
  };
}

export async function searchSermonsByConcern(
  query: string,
): Promise<ConcernSearchResponse> {
  const trimmed = query.trim();
  const all = await fetchAllSearchSermons();
  const emptyTags: Pick<ConcernSearchResponse, "tagScores" | "primaryTags"> = {
    tagScores: [],
    primaryTags: [],
  };

  if (!hasGeminiApiKey()) {
    return {
      results: searchSermonsBySimpleTextMatch(trimmed, all),
      ...emptyTags,
      query: trimmed,
    };
  }

  try {
    const embeddingResults = await searchSermonsByEmbedding(trimmed, all);
    if (embeddingResults !== null) {
      return {
        results: embeddingResults,
        ...emptyTags,
        query: trimmed,
      };
    }
  } catch {
    // 임베딩 실패 시 태그·단순 검색으로 폴백
  }

  try {
    return await searchSermonsByConcernTags(trimmed, all);
  } catch {
    return {
      results: searchSermonsBySimpleTextMatch(trimmed, all),
      ...emptyTags,
      query: trimmed,
    };
  }
}
