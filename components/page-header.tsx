import { HomeLink } from "@/components/home-link";

type PageHeaderProps = {
  title?: string;
  subtitle?: string;
};

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-4 flex min-h-11 w-full items-center justify-between gap-3">
      <div className="min-w-0 flex-1 translate-y-1">
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
      <HomeLink />
    </header>
  );
}
