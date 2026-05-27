import { parseKeywords } from "@/lib/sermon-parse";

export type KeywordStat = {
  keyword: string;
  count: number;
};

/** 사전별 탭 (쌍자음은 해당 기본 자음으로 묶음) */
export const KEYWORD_JAMO_TABS = [
  "ㄱ",
  "ㄴ",
  "ㄷ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅅ",
  "ㅇ",
  "ㅈ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
] as const;

export type KeywordJamoTab = (typeof KEYWORD_JAMO_TABS)[number];

const CHOSEONG = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
] as const;

const CHOSEONG_TO_TAB: Partial<Record<string, KeywordJamoTab>> = {
  "ㄲ": "ㄱ",
  "ㄸ": "ㄷ",
  "ㅃ": "ㅂ",
  "ㅆ": "ㅅ",
  "ㅉ": "ㅈ",
};

function choseongToTab(choseong: string): KeywordJamoTab | null {
  if (CHOSEONG_TO_TAB[choseong]) {
    return CHOSEONG_TO_TAB[choseong]!;
  }
  if ((KEYWORD_JAMO_TABS as readonly string[]).includes(choseong)) {
    return choseong as KeywordJamoTab;
  }
  return null;
}

/** 키워드 첫 글자의 한글 초성 탭 (한글이 아니면 null) */
export function getKeywordJamoTab(keyword: string): KeywordJamoTab | null {
  const trimmed = keyword.trim();
  if (!trimmed) {
    return null;
  }

  const code = trimmed.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) {
    return null;
  }

  const choseongIndex = Math.floor((code - 0xac00) / 588);
  const choseong = CHOSEONG[choseongIndex];
  return choseong ? choseongToTab(choseong) : null;
}

/** DB keywords 전체를 가나다순 유일 목록으로 */
export function computeAllKeywords(rows: { keywords: unknown }[]): string[] {
  const unique = new Set<string>();

  for (const row of rows) {
    for (const raw of parseKeywords(row.keywords)) {
      const keyword = raw.trim();
      if (keyword) {
        unique.add(keyword);
      }
    }
  }

  return Array.from(unique).sort((a, b) => a.localeCompare(b, "ko-KR"));
}

export function filterKeywordsByJamo(
  keywords: string[],
  jamo: KeywordJamoTab,
): string[] {
  return keywords.filter((keyword) => getKeywordJamoTab(keyword) === jamo);
}

function buildKeywordCounts(rows: { keywords: unknown }[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    for (const raw of parseKeywords(row.keywords)) {
      const keyword = raw.trim();
      if (!keyword) {
        continue;
      }
      counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
    }
  }

  return counts;
}

/** 검색 인기 키워드에서 제외 (하나님 나라, 하나님의 사랑 등) */
export function isExcludedFromSearchPopularKeywords(keyword: string): boolean {
  const k = keyword.trim();
  if (!k) {
    return true;
  }
  return k === "하나님" || k.startsWith("하나님의 ") || k.startsWith("하나님 ");
}

/** 검색 화면 인기 키워드 — 항상 노출할 태그 */
export const PINNED_SEARCH_KEYWORDS = [
  "믿음",
  "결단",
  "사랑",
  "감사",
  "두려움",
] as const;

const GOD_PREFIXES = ["하나님의 ", "하나님 "];
const FALLBACK_GOD_KEYWORD = "하나님 나라";

function isGodKeyword(keyword: string): boolean {
  const k = keyword.trim();
  return GOD_PREFIXES.some((prefix) => k.startsWith(prefix));
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandomByDay<T>(items: T[], daySeed: string): T | null {
  if (items.length === 0) {
    return null;
  }
  const random = makeSeededRandom(hashString(daySeed));
  const index = Math.floor(random() * items.length);
  return items[index] ?? null;
}

function pickManyRandomByDay<T>(items: T[], n: number, daySeed: string): T[] {
  if (n <= 0 || items.length === 0) {
    return [];
  }
  const random = makeSeededRandom(hashString(daySeed));
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, Math.min(n, pool.length));
}

function seoulDaySeed(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * 검색 인기 키워드: 고정 태그 + DB 빈도 상위(하나님* 제외, 하나님의 심판은 고정).
 * @param limit 전체 노출 개수 (기본 22)
 */
export function computeSearchPopularKeywords(
  rows: { keywords: unknown }[],
  limit = 10,
): KeywordStat[] {
  const counts = buildKeywordCounts(rows);
  const daySeed = seoulDaySeed();
  const fixed: KeywordStat[] = PINNED_SEARCH_KEYWORDS.map((keyword) => ({
    keyword,
    count: counts.get(keyword) ?? 0,
  }));
  const fixedSet = new Set(fixed.map((row) => row.keyword));

  const godCandidates = Array.from(counts.entries())
    .filter(([keyword, count]) => isGodKeyword(keyword) && count > 0)
    .map(([keyword]) => keyword)
    .sort((a, b) => a.localeCompare(b, "ko-KR"));
  const selectedGod =
    pickRandomByDay(godCandidates, `${daySeed}:god`) ?? FALLBACK_GOD_KEYWORD;

  const top20 = Array.from(counts.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword, "ko-KR"))
    .slice(0, 20);
  const randomPool = top20.filter(
    ({ keyword }) =>
      !fixedSet.has(keyword) &&
      keyword !== selectedGod &&
      !isExcludedFromSearchPopularKeywords(keyword),
  );
  const random4 = pickManyRandomByDay(randomPool, 4, `${daySeed}:top20`);

  const merged = [
    ...fixed,
    { keyword: selectedGod, count: counts.get(selectedGod) ?? 0 },
    ...random4,
  ];

  return merged.slice(0, limit);
}

/** 설교 keywords 배열을 모아 빈도순 상위 키워드 반환 */
export function computeTopKeywords(
  rows: { keywords: unknown }[],
  limit = 20,
): KeywordStat[] {
  const counts = buildKeywordCounts(rows);

  return Array.from(counts.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.keyword.localeCompare(b.keyword, "ko-KR"),
    )
    .slice(0, limit);
}
