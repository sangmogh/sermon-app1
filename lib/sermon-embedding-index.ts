import { readFile } from "node:fs/promises";
import path from "node:path";

import type { SearchResultSermon } from "@/lib/search";

export type SermonEmbeddingEntry = {
  id: string;
  embedding: number[];
};

export type SermonEmbeddingIndex = {
  version: 1;
  model: string;
  updatedAt: string;
  entries: SermonEmbeddingEntry[];
};

const INDEX_RELATIVE = path.join("data", "sermon-embeddings.json");

let cached:
  | { loadedAt: number; index: SermonEmbeddingIndex | null }
  | undefined;

const CACHE_MS = 60_000;

export function sermonEmbeddingIndexPath(): string {
  return path.join(process.cwd(), INDEX_RELATIVE);
}

export function buildSermonEmbeddingText(sermon: SearchResultSermon): string {
  const lines = [`제목: ${sermon.title}`];
  if (sermon.core_bible_verse?.trim()) {
    lines.push(`핵심말씀: ${sermon.core_bible_verse.trim()}`);
  }
  if (sermon.summary?.trim()) {
    lines.push(`요약: ${sermon.summary.trim()}`);
  }
  if (sermon.keywords.length > 0) {
    lines.push(`키워드: ${sermon.keywords.join(", ")}`);
  }
  return lines.join("\n");
}

export async function loadSermonEmbeddingIndex(): Promise<SermonEmbeddingIndex | null> {
  const now = Date.now();
  if (cached && now - cached.loadedAt < CACHE_MS) {
    return cached.index;
  }

  let index: SermonEmbeddingIndex | null = null;
  try {
    const raw = await readFile(sermonEmbeddingIndexPath(), "utf8");
    const parsed = JSON.parse(raw) as SermonEmbeddingIndex;
    if (
      parsed?.version === 1 &&
      Array.isArray(parsed.entries) &&
      parsed.entries.length > 0
    ) {
      index = parsed;
    }
  } catch {
    index = null;
  }

  cached = { loadedAt: now, index };
  return index;
}

export function clearSermonEmbeddingIndexCache(): void {
  cached = undefined;
}
