import type { Sermon } from "@/lib/supabase";

export type MonthGroup = {
  label: string;
  sermons: Sermon[];
};

/** sermon_date만 파싱 (created_at 사용 안 함) */
export function parseSermonDateValue(raw: unknown): Date | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const value =
    typeof raw === "string"
      ? raw.trim()
      : typeof raw === "number" && !Number.isNaN(raw)
        ? String(raw)
        : "";

  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function getSermonDate(sermon: Sermon): Date | null {
  return parseSermonDateValue(sermon.sermon_date);
}

export function hasValidSermonDate(sermon: Sermon): boolean {
  return getSermonDate(sermon) !== null;
}

export function getSermonYear(sermon: Sermon): number | null {
  const date = getSermonDate(sermon);
  return date ? date.getFullYear() : null;
}

/** sermon_date 기준 존재하는 연도 (최신순, 중복 제거) */
export function collectArchiveYears(sermons: Sermon[]): number[] {
  const years = new Set<number>();
  for (const sermon of sermons) {
    const year = getSermonYear(sermon);
    if (year !== null) {
      years.add(year);
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}

export function filterSermonsByYear(sermons: Sermon[], year: number): Sermon[] {
  return sermons.filter((sermon) => getSermonYear(sermon) === year);
}

export function formatSermonDateLabel(sermon: Sermon): string {
  const date = getSermonDate(sermon);
  if (!date) {
    return "날짜 미상";
  }

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** 유효한 sermon_date일 때만 일자(DD) 반환 */
export function formatSermonDayNumber(sermon: Sermon): string | null {
  const date = getSermonDate(sermon);
  if (!date) {
    return null;
  }

  return `${date.getDate()}`;
}

/** 카드 원형 배지용 짧은 월 라벨 (예: 2월) */
export function formatSermonMonthShort(sermon: Sermon): string | null {
  const date = getSermonDate(sermon);
  if (!date) {
    return null;
  }

  return `${date.getMonth() + 1}월`;
}

export function getSermonMonthLabel(sermon: Sermon): string {
  const date = getSermonDate(sermon);
  if (!date) {
    return "날짜 미상";
  }

  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function getSermonDateTimestamp(sermon: Sermon): number | null {
  const date = getSermonDate(sermon);
  return date ? date.getTime() : null;
}

export function sortSermonsBySermonDate(sermons: Sermon[]): Sermon[] {
  return [...sermons].sort((a, b) => {
    const aTime = getSermonDateTimestamp(a);
    const bTime = getSermonDateTimestamp(b);

    if (aTime === null && bTime === null) {
      return 0;
    }
    if (aTime === null) {
      return 1;
    }
    if (bTime === null) {
      return -1;
    }

    return bTime - aTime;
  });
}

export function groupSermonsByMonth(sermons: Sermon[]): MonthGroup[] {
  const sorted = sortSermonsBySermonDate(sermons);
  const map = new Map<string, Sermon[]>();

  for (const sermon of sorted) {
    const label = getSermonMonthLabel(sermon);
    const existing = map.get(label);

    if (existing) {
      existing.push(sermon);
    } else {
      map.set(label, [sermon]);
    }
  }

  return Array.from(map.entries())
    .map(([label, groupSermons]) => ({
      label,
      sermons: groupSermons.sort((a, b) => {
        const aTime = getSermonDateTimestamp(a) ?? 0;
        const bTime = getSermonDateTimestamp(b) ?? 0;
        return bTime - aTime;
      }),
    }))
    .sort((a, b) => {
      if (a.label === "날짜 미상" && b.label !== "날짜 미상") {
        return 1;
      }
      if (b.label === "날짜 미상" && a.label !== "날짜 미상") {
        return -1;
      }
      if (a.label === "날짜 미상" && b.label === "날짜 미상") {
        return 0;
      }

      const aTime = getSermonDateTimestamp(a.sermons[0] ?? ({} as Sermon)) ?? 0;
      const bTime = getSermonDateTimestamp(b.sermons[0] ?? ({} as Sermon)) ?? 0;
      return bTime - aTime;
    });
}
