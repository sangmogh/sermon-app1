import Link from "next/link";
import { Home } from "lucide-react";

export function HomeLink() {
  return (
    <Link
      href="/"
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-sm transition-colors hover:bg-muted active:scale-95"
      aria-label="홈으로 이동"
    >
      <Home className="size-6" strokeWidth={2} />
    </Link>
  );
}
