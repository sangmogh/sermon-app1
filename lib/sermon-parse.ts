export type NormalizedSermonPoint = {
  point_title: string;
  start_time: string;
  start_seconds: number;
  description: string;
};

export type NormalizedGraceNote = {
  quote: string;
  start_time: string;
  start_seconds: number;
};

export type NormalizedDecisionPrayer = {
  prayer_text: string;
  start_time: string;
  start_seconds: number;
};

export type NormalizedSermon = {
  id: string;
  title: string;
  core_bible_verse: string;
  keywords: string[];
  summary: string;
  points: NormalizedSermonPoint[];
  grace_notes: NormalizedGraceNote[];
  decision_prayer: NormalizedDecisionPrayer | null;
  created_at: string;
};

function pickString(
  obj: Record<string, unknown>,
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && !Number.isNaN(value)) {
      return String(value);
    }
  }
  return fallback;
}

export function parseTimeToSeconds(time: unknown): number {
  if (time === null || time === undefined) {
    return 0;
  }

  if (typeof time === "number" && !Number.isNaN(time)) {
    return Math.max(0, Math.floor(time));
  }

  const raw = String(time).trim();
  if (!raw) {
    return 0;
  }

  if (/^\d+$/.test(raw)) {
    return parseInt(raw, 10);
  }

  const cleaned = raw.replace(/[\[\]]/g, "");
  const parts = cleaned.split(":").map((part) => parseInt(part.trim(), 10));

  if (parts.some((part) => Number.isNaN(part))) {
    return 0;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return 0;
}

export function formatTimeDisplay(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function parseKeywords(raw: unknown): string[] {
  if (raw === null || raw === undefined) {
    return [];
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    try {
      return parseKeywords(JSON.parse(trimmed));
    } catch {
      return [trimmed];
    }
  }

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }
      if (typeof item === "number" && !Number.isNaN(item)) {
        return String(item);
      }
      return "";
    })
    .filter(Boolean);
}

export function parsePoints(raw: unknown): NormalizedSermonPoint[] {
  let data = raw;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(data)) {
    return [];
  }

  const points = data
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const obj = item as Record<string, unknown>;
      const point_title =
        pickString(obj, ["point_title", "pointTitle", "title", "name"]) ||
        `포인트 ${index + 1}`;

      const secondsFromDb = obj.start_time_seconds ?? obj.startTimeSeconds;
      const timeTextRaw =
        obj.start_time ??
        obj.start_time_text ??
        obj.startTime ??
        obj.startTimeText ??
        obj.timestamp ??
        obj.time;

      const start_seconds =
        typeof secondsFromDb === "number" && !Number.isNaN(secondsFromDb)
          ? Math.max(0, Math.floor(secondsFromDb))
          : parseTimeToSeconds(timeTextRaw);

      const start_time =
        typeof timeTextRaw === "string" && timeTextRaw.trim()
          ? timeTextRaw.trim().replace(/[\[\]]/g, "")
          : formatTimeDisplay(start_seconds);

      const description =
        pickString(obj, ["description", "desc", "summary", "content", "text"]) ||
        "설명이 없습니다.";

      return {
        point: {
          point_title,
          start_time,
          start_seconds,
          description,
        },
        index,
      };
    })
    .filter(
      (
        entry,
      ): entry is { point: NormalizedSermonPoint; index: number } =>
        entry !== null,
    );

  return points
    .sort((a, b) => {
      const byTime = a.point.start_seconds - b.point.start_seconds;
      return byTime !== 0 ? byTime : a.index - b.index;
    })
    .map(({ point }) => point);
}

export function parseGraceNotes(raw: unknown): NormalizedGraceNote[] {
  let data = raw;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const wrapped = data as Record<string, unknown>;
    if (Array.isArray(wrapped.items)) {
      data = wrapped.items;
    } else if (Array.isArray(wrapped.notes)) {
      data = wrapped.notes;
    } else {
      return [];
    }
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const obj = item as Record<string, unknown>;
      const quote = pickString(obj, ["quote", "text", "content", "note"]);
      if (!quote) {
        return null;
      }

      const secondsFromDb = obj.start_time_seconds ?? obj.startTimeSeconds;
      const timeTextRaw =
        obj.start_time_text ??
        obj.start_time ??
        obj.startTimeText ??
        obj.startTime ??
        obj.timestamp ??
        obj.time;

      const start_seconds =
        typeof secondsFromDb === "number" && !Number.isNaN(secondsFromDb)
          ? Math.max(0, Math.floor(secondsFromDb))
          : parseTimeToSeconds(timeTextRaw);

      const start_time =
        typeof timeTextRaw === "string" && timeTextRaw.trim()
          ? timeTextRaw.trim().replace(/[\[\]]/g, "")
          : formatTimeDisplay(start_seconds);

      return {
        quote,
        start_time,
        start_seconds,
      };
    })
    .filter((note): note is NormalizedGraceNote => note !== null);
}

export function parseDecisionPrayer(raw: unknown): NormalizedDecisionPrayer | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const obj = data as Record<string, unknown>;
  const prayer_text = pickString(obj, [
    "prayer_text",
    "prayer",
    "text",
    "quote",
    "content",
  ]);
  if (!prayer_text) {
    return null;
  }

  const secondsFromDb = obj.start_time_seconds ?? obj.startTimeSeconds;
  const timeTextRaw =
    obj.start_time_text ??
    obj.start_time ??
    obj.startTimeText ??
    obj.startTime ??
    obj.timestamp ??
    obj.time;

  const start_seconds =
    typeof secondsFromDb === "number" && !Number.isNaN(secondsFromDb)
      ? Math.max(0, Math.floor(secondsFromDb))
      : parseTimeToSeconds(timeTextRaw);

  const start_time =
    typeof timeTextRaw === "string" && timeTextRaw.trim()
      ? timeTextRaw.trim().replace(/[\[\]]/g, "")
      : formatTimeDisplay(start_seconds);

  return {
    prayer_text,
    start_time,
    start_seconds,
  };
}

export function buildYoutubeDeepLink(
  videoId: string,
  seconds: number,
): string | null {
  const id = String(videoId ?? "").trim();
  if (!id) {
    return null;
  }

  const base = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  if (seconds > 0) {
    return `${base}&t=${seconds}s`;
  }

  return base;
}

export function normalizeSermon(raw: Record<string, unknown>): NormalizedSermon {
  const createdAt =
    typeof raw.created_at === "string" && raw.created_at.trim()
      ? raw.created_at
      : new Date().toISOString();

  return {
    id:
      pickString(raw, ["id", "youtube_id", "youtubeId", "video_id"]) ||
      "unknown",
    title: pickString(raw, ["title"]) || "제목 없음",
    core_bible_verse:
      pickString(raw, [
        "core_bible_verse",
        "coreBibleVerse",
        "bible_verse",
        "verse",
      ]) || "핵심 말씀 정보가 없습니다.",
    summary: pickString(raw, ["summary"]) || "요약 정보가 없습니다.",
    keywords: parseKeywords(raw.keywords),
    points: parsePoints(raw.points),
    grace_notes: parseGraceNotes(raw.grace_notes ?? raw.graceNotes),
    decision_prayer: parseDecisionPrayer(
      raw.decision_prayer ?? raw.decisionPrayer,
    ),
    created_at: createdAt,
  };
}

export function formatSermonDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
