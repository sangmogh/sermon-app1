import { PageTopBar } from "@/components/page-top-bar";

type SubPageHeaderProps = {
  title?: string;
  subtitle?: string;
  backHref?: string;
  /** false면 제목·부제 없이 뒤로가기·홈만 (설교 상세 등) */
  showTitle?: boolean;
};

export function SubPageHeader({
  title,
  subtitle,
  backHref = "/",
  showTitle = true,
}: SubPageHeaderProps) {
  const hasTitleBlock = showTitle && Boolean(title ?? subtitle);

  return (
    <header className={`w-full ${hasTitleBlock ? "mb-4" : "mb-2"}`}>
      <PageTopBar backHref={backHref} />
      {hasTitleBlock ? (
        <div className="mt-3 min-w-0">
          {title ? (
            <h1 className="text-xl font-bold leading-tight text-foreground">
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
