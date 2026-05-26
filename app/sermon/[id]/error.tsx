"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { PageShell } from "@/components/page-layout";
import { SubPageHeader } from "@/components/sub-page-header";

export default function SermonDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AppShell>
      <PageShell>
        <SubPageHeader title="오늘의 말씀" />
        <div className="rounded-3xl bg-card px-6 py-12 text-center shadow-sm">
          <p className="text-base font-semibold text-foreground">
            설교를 불러오지 못했어요
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            잠시 후 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95"
          >
            다시 시도
          </button>
        </div>
      </PageShell>
    </AppShell>
  );
}
