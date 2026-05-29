import type { Sermon } from "@/lib/supabase";

/** "오늘의 말씀" 풀에서 제외할 연도 (해당 연도 설교는 추천하지 않음) */
const EXCLUDED_YEARS = new Set(["2026"]);

/** 한국 시간(KST) 기준 오늘 날짜 키 (자정마다 추천 설교가 바뀜) */
export function getKstDayKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

/** KST 날짜를 1씩 증가하는 정수(에폭 이후 일수)로 변환 */
function getKstDayNumber(date = new Date()): number {
  const [year, month, day] = getKstDayKey(date).split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** 시드 기반 의사난수 (mulberry32) — 같은 시드면 항상 같은 수열 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 시드로 결정되는 Fisher-Yates 셔플 (원본 불변) */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  const rand = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 겹침 없는 일일 순환 추천.
 * - 2026년 설교는 풀에서 제외
 * - 풀을 시드로 섞은 뒤 하루에 하나씩 → 풀을 한 바퀴 다 돌 때까지 중복 없음
 * - 한 바퀴(=풀 크기 일수)가 끝나면 새 시드로 다시 섞어 같은 풀에서 또 순환
 * - 날짜 기반 결정론이라 "하루 고정 + 매일 변경 + 모두에게 동일" 유지
 */
export function pickTodaySermon(sermons: Sermon[]): Sermon | null {
  const pool = sermons.filter((sermon) => {
    const year = (sermon.sermon_date ?? "").slice(0, 4);
    return !EXCLUDED_YEARS.has(year);
  });

  if (pool.length === 0) {
    return null;
  }

  // DB 반환 순서에 흔들리지 않도록 id 기준 고정 정렬 후 섞는다.
  const ordered = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  const size = ordered.length;

  const dayNumber = getKstDayNumber();
  const cycle = Math.floor(dayNumber / size); // 몇 바퀴째인지 → 매 바퀴 다른 시드
  const position = ((dayNumber % size) + size) % size; // 이번 바퀴에서의 순서

  const shuffled = seededShuffle(ordered, cycle + 1);
  return shuffled[position];
}
