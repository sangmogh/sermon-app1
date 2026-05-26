import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageShell } from "@/components/page-layout";
import { SubPageHeader } from "@/components/sub-page-header";

export default function SermonNotFound() {
  return (
    <AppShell>
      <PageShell>
        <SubPageHeader showTitle={false} />
        <div className="rounded-3xl bg-card px-6 py-12 text-center shadow-sm">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
            <FileQuestion className="size-8 text-muted-foreground" />
          </div>
          <p className="mt-4 text-base font-semibold text-foreground">
            설교를 찾을 수 없습니다
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            삭제되었거나 잘못된 주소일 수 있어요.
          </p>
          <Link
            href="/"
            className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </PageShell>
    </AppShell>
  );
}
