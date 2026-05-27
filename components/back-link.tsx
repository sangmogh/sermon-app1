"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type BackLinkProps = {
  href?: string;
};

export function BackLink({ href = "/" }: BackLinkProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(href);
      }}
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-sm transition-colors hover:bg-muted active:scale-95"
      aria-label="뒤로 가기"
    >
      <ArrowLeft className="size-5" strokeWidth={2} />
    </button>
  );
}
