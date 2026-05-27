"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Inbox, Search } from "lucide-react";
import { SearchResultsSkeleton } from "@/components/skeleton";
import {
  formatSearchResultDate,
  searchSermons,
  type SearchResultSermon,
} from "@/lib/search";
import type { KeywordStat } from "@/lib/keyword-stats";

type SearchClientProps = {
  topKeywords: KeywordStat[];
};

type ConcernSearchResponse = {
  results: SearchResultSermon[];
  query: string;
};

function KeywordTagButton({
  keyword,
  onClick,
}: {
  keyword: string;
  onClick: (keyword: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(keyword)}
      className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground active:scale-95"
    >
      #{keyword}
    </button>
  );
}

export function SearchClient({ topKeywords }: SearchClientProps) {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const lastSearchedRef = useRef("");
  const concernRequestIdRef = useRef(0);

  const [inputValue, setInputValue] = useState(initialQuery);
  const [results, setResults] = useState<SearchResultSermon[]>([]);
  const [displayQuery, setDisplayQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const runTagSearch = useCallback(async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      setDisplayQuery("");
      setErrorMessage(null);
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);
    setDisplayQuery(trimmed);

    try {
      const data = await searchSermons(trimmed);
      setResults(data);
      setHasSearched(true);
    } catch (error) {
      setResults([]);
      setHasSearched(true);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "검색 중 오류가 발생했습니다.",
      );
    } finally {
      setIsSearching(false);
    }
  }, []);

  const syncQueryToUrl = useCallback((query: string) => {
    if (typeof window === "undefined") {
      return;
    }
    const next = `/search?q=${encodeURIComponent(query)}`;
    if (window.location.pathname + window.location.search === next) {
      return;
    }
    window.history.replaceState(window.history.state, "", next);
  }, []);

  const runConcernSearch = useCallback(
    async (value: string, options?: { syncUrl?: boolean }) => {
      const trimmed = value.trim();
      if (!trimmed) {
        lastSearchedRef.current = "";
        setResults([]);
        setHasSearched(false);
        setDisplayQuery("");
        setErrorMessage(null);
        setIsSearching(false);
        return;
      }

      lastSearchedRef.current = trimmed;
      const requestId = ++concernRequestIdRef.current;

      setIsSearching(true);
      setErrorMessage(null);
      setDisplayQuery(trimmed);

      if (options?.syncUrl !== false) {
        syncQueryToUrl(trimmed);
      }

      try {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        });

        const payload = (await response.json()) as
          | ConcernSearchResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "검색 중 오류가 발생했습니다.",
          );
        }

        if (requestId !== concernRequestIdRef.current) {
          return;
        }

        const data = payload as ConcernSearchResponse;
        setResults(data.results);
        setHasSearched(true);
      } catch (error) {
        if (requestId !== concernRequestIdRef.current) {
          return;
        }
        setResults([]);
        setHasSearched(true);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "검색 중 오류가 발생했습니다.",
        );
      } finally {
        if (requestId === concernRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    },
    [syncQueryToUrl],
  );

  const runConcernSearchRef = useRef(runConcernSearch);
  runConcernSearchRef.current = runConcernSearch;

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setInputValue(q);
    const trimmed = q.trim();
    if (!trimmed) {
      lastSearchedRef.current = "";
      return;
    }
    if (trimmed === lastSearchedRef.current) {
      return;
    }
    void runConcernSearchRef.current(trimmed, { syncUrl: false });
  }, [searchParams]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runConcernSearch(inputValue, { syncUrl: true });
  };

  const handleTagClick = (tag: string) => {
    lastSearchedRef.current = `tag:${tag}`;
    setInputValue(tag);
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", "/search");
    }
    void runTagSearch(tag);
  };

  return (
    <div className="flex flex-col pb-6">
      <form onSubmit={handleSubmit} className="mb-3">
        <label htmlFor="sermon-search" className="sr-only">
          설교 검색
        </label>
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm ring-1 ring-border/60 focus-within:ring-2 focus-within:ring-primary/30">
          <Search
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <input
            id="sermon-search"
            type="search"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="고민을 입력해보세요"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            enterKeyHint="search"
          />
          <button
            type="submit"
            disabled={isSearching || !inputValue.trim()}
            className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
          >
            검색
          </button>
        </div>
        <div className="mt-2 px-1 text-[14px] leading-relaxed text-foreground/90">
          <p>고민이나 상황을 적으면 설교를 찾아드려요</p>
          <p className="mt-1.5 text-foreground/90">
            예: 구원의 확신이 없어요 · 믿음을 키우는 법
          </p>
          <p className="pl-[1.125rem] text-foreground/90">
            어떻게 살아가야 할까요 · 기도 응답이 안 와요
          </p>
        </div>
      </form>

      {topKeywords.length > 0 ? (
        <section className="rounded-2xl bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">인기 키워드</h3>
          <div className="mt-3 flex w-full flex-wrap gap-2">
            {topKeywords.map(({ keyword }) => (
              <KeywordTagButton
                key={keyword}
                keyword={keyword}
                onClick={handleTagClick}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div
        className={`mt-6 flex flex-col gap-3 transition-opacity ${isSearching && results.length > 0 ? "opacity-60" : ""}`}
      >
        {isSearching && results.length === 0 ? <SearchResultsSkeleton /> : null}

        {errorMessage ? (
          <div className="rounded-2xl bg-card p-5 text-center shadow-sm">
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
        ) : null}

        {!isSearching && !errorMessage && hasSearched && results.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl bg-card px-6 py-12 text-center shadow-sm">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
              <Inbox className="size-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              검색 결과가 없어요
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              &apos;{displayQuery}&apos;와(과) 맞는 설교를 찾지 못했습니다.
              <br />
              다른 표현으로 검색하거나 키워드를 눌러 보세요.
            </p>
          </div>
        ) : null}

        {!isSearching && !errorMessage && results.length > 0 ? (
          <>
            <p className="text-sm font-semibold text-muted-foreground">
              총 {results.length}건이 검색되었습니다
            </p>
            {results.map((result) => (
              <Link
                key={result.id}
                href={`/sermon/${result.id}`}
                className="flex flex-col items-start rounded-2xl bg-card p-5 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
              >
                <span className="text-xs text-muted-foreground">
                  {formatSearchResultDate(result)}
                </span>
                <h4 className="mt-1 text-base font-semibold text-foreground">
                  {result.title}
                </h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.core_bible_verse}
                </p>
                {result.keywords.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.keywords.slice(0, 4).map((keyword, idx) => (
                      <span
                        key={`${keyword}-${idx}`}
                        className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                      >
                        #{keyword}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Link>
            ))}
          </>
        ) : null}

      </div>
    </div>
  );
}
