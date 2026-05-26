import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type BackLinkProps = {
  href?: string;
};

export function BackLink({ href = "/" }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-sm transition-colors hover:bg-muted active:scale-95"
      aria-label="뒤로 가기"
    >
      <ArrowLeft className="size-5" strokeWidth={2} />
    </Link>
  );
}
