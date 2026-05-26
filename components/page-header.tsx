import { HomeLink } from "@/components/home-link";

type PageHeaderProps = {
  title?: string;
  subtitle?: string;
};

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-4 flex w-full items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {title ? (
          <h1 className="text-xl font-bold leading-tight text-foreground">
            {title}
          </h1>
        ) : (
          <span className="sr-only">페이지</span>
        )}
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {/* 서브 페이지 PageTopBar와 동일: h-11 우측 고정 */}
      <div className="flex h-11 shrink-0 items-center justify-center">
        <HomeLink />
      </div>
    </header>
  );
}
