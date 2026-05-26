import { PageTopBar } from "@/components/page-top-bar";

type PageHeaderProps = {
  title?: string;
  subtitle?: string;
};

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-4 w-full">
      <PageTopBar showBack={false} />
      <div className="mt-3 min-w-0">
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
    </header>
  );
}
