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

/** 설교 keywords 배열을 모아 빈도순 상위 키워드 반환 */
export function computeTopKeywords(
  rows: { keywords: unknown }[],
  limit = 20,
): KeywordStat[] {
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

  return Array.from(counts.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.keyword.localeCompare(b.keyword, "ko-KR"),
    )
    .slice(0, limit);
}
