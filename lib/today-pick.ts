import type { Sermon } from "@/lib/supabase";

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

function hashDayKey(dayKey: string): number {
  let hash = 0;
  for (let i = 0; i < dayKey.length; i++) {
    hash = (hash << 5) - hash + dayKey.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** 매일 자정(KST)마다 동일한 설교가 추천되도록 결정 */
export function pickTodaySermon(sermons: Sermon[]): Sermon | null {
  if (sermons.length === 0) {
    return null;
  }

  const dayKey = getKstDayKey();
  const index = hashDayKey(dayKey) % sermons.length;
  return sermons[index];
}
