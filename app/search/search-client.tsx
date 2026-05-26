"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { useSearchParams } from "next/navigation";

import { Inbox } from "lucide-react";

import { SearchResultsSkeleton } from "@/components/skeleton";

import {

  formatSearchResultDate,

  searchSermons,

  type SearchResultSermon,

} from "@/lib/search";

import {

  filterKeywordsByJamo,

  KEYWORD_JAMO_TABS,

  type KeywordJamoTab,

  type KeywordStat,

} from "@/lib/keyword-stats";



type SearchClientProps = {

  topKeywords: KeywordStat[];

  allKeywords: string[];

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



export function SearchClient({ topKeywords, allKeywords }: SearchClientProps) {

  const searchParams = useSearchParams();

  const initialQuery = searchParams.get("q") ?? "";



  const [query, setQuery] = useState(initialQuery);

  const [results, setResults] = useState<SearchResultSermon[]>([]);

  const [isSearching, setIsSearching] = useState(false);

  const [hasSearched, setHasSearched] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedJamo, setSelectedJamo] = useState<KeywordJamoTab | null>(null);



  const jamoKeywords = useMemo(() => {

    if (!selectedJamo) {

      return [];

    }

    return filterKeywordsByJamo(allKeywords, selectedJamo);

  }, [allKeywords, selectedJamo]);



  const runSearch = useCallback(async (value: string) => {

    const trimmed = value.trim();

    if (!trimmed) {

      setResults([]);

      setHasSearched(false);

      setErrorMessage(null);

      return;

    }



    setIsSearching(true);

    setErrorMessage(null);



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



  useEffect(() => {

    const q = searchParams.get("q") ?? "";

    setQuery(q);

  }, [searchParams]);



  useEffect(() => {

    const timer = window.setTimeout(() => {

      void runSearch(query);

    }, 300);



    return () => window.clearTimeout(timer);

  }, [query, runSearch]);



  const handleTagClick = (tag: string) => {

    setQuery(tag);

  };



  const handleJamoClick = (jamo: KeywordJamoTab) => {

    setSelectedJamo((prev) => (prev === jamo ? null : jamo));

  };



  return (

    <div className="flex flex-col pb-6">

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



      <section className="mt-4 rounded-2xl bg-card p-4 shadow-sm">

        <h3 className="text-sm font-semibold text-foreground">사전별</h3>

        <div className="mt-3 flex flex-wrap gap-2">

          {KEYWORD_JAMO_TABS.map((jamo) => {

            const isSelected = selectedJamo === jamo;

            return (

              <button

                key={jamo}

                type="button"

                onClick={() => handleJamoClick(jamo)}

                className={`flex size-10 items-center justify-center rounded-xl text-sm font-semibold transition-colors active:scale-95 ${

                  isSelected

                    ? "bg-primary text-primary-foreground"

                    : "bg-muted text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"

                }`}

                aria-pressed={isSelected}

                aria-label={`${jamo}으로 시작하는 키워드`}

              >

                {jamo}

              </button>

            );

          })}

        </div>



        {selectedJamo ? (

          jamoKeywords.length > 0 ? (

            <div className="mt-4 flex w-full flex-wrap gap-2 border-t border-border pt-4">

              {jamoKeywords.map((keyword) => (

                <KeywordTagButton

                  key={keyword}

                  keyword={keyword}

                  onClick={handleTagClick}

                />

              ))}

            </div>

          ) : (

            <p className="mt-4 border-t border-border pt-4 text-center text-sm text-muted-foreground">

              {selectedJamo}으로 시작하는 키워드가 없습니다.

            </p>

          )

        ) : (

          <p className="mt-3 text-xs text-muted-foreground">

            초성을 누르면 해당 글자로 시작하는 키워드가 나옵니다.

          </p>

        )}

      </section>



      <div className="mt-6 flex flex-col gap-3">

        {isSearching ? <SearchResultsSkeleton /> : null}



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

              &apos;{query}&apos;와(과) 일치하는 설교를 찾지 못했습니다.

              <br />

              다른 키워드를 눌러 보세요.

            </p>

          </div>

        ) : null}



        {!isSearching && !errorMessage && results.length > 0 ? (

          <>

            <h3 className="text-sm font-semibold text-muted-foreground">

              &apos;{query}&apos; 검색 결과 {results.length}건

            </h3>

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



        {!isSearching && !errorMessage && !hasSearched ? (

          <p className="py-8 text-center text-sm text-muted-foreground">

            인기·사전별 키워드를 눌러 설교를 찾아 보세요.

          </p>

        ) : null}

      </div>

    </div>

  );

}


