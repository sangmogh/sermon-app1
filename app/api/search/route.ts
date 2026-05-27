import { NextResponse } from "next/server";

import { searchSermonsByConcern } from "@/lib/concern-search";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<
  string,
  { at: number; body: Awaited<ReturnType<typeof searchSermonsByConcern>> }
>();

export async function POST(request: Request) {
  let body: { query?: string };
  try {
    body = (await request.json()) as { query?: string };
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json(
      { error: "검색어를 입력해 주세요." },
      { status: 400 },
    );
  }

  const cacheKey = `v7-embed:${query.toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.body);
  }

  try {
    const result = await searchSermonsByConcern(query);
    cache.set(cacheKey, { at: Date.now(), body: result });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "검색 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
