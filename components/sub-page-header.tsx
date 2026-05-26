import { BackLink } from "@/components/back-link";
import { HomeLink } from "@/components/home-link";

type SubPageHeaderProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
};

export function SubPageHeader({
  title,
  subtitle,
  backHref = "/",
}: SubPageHeaderProps) {
  return (
    <header className="mb-4 w-full">
      <div className="flex items-center justify-between gap-3">
        <BackLink href={backHref} />
        <HomeLink />
      </div>
      <h1 className="mt-3 text-xl font-bold leading-tight text-foreground">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
    </header>
  );
}
