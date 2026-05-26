import type { ReactNode } from "react";

/** 홈 UI py-10(2.5rem) 수준 고정 여백 + 노치·URL바 safe-area */
const PAGE_TOP_PADDING =
  "pt-[calc(2.5rem+env(safe-area-inset-top,0px))]";

/** 공통 페이지 껍데기: 상단 safe-area + 가로 패딩, 하단 여백·세로 중앙 정렬 없음 */
export function PageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-[100dvh] w-full flex-col px-6 ${PAGE_TOP_PADDING} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

/** 설교 상세 — 바깥 상단 패딩 없음(sticky 헤더가 safe-area 담당) */
export function PageScrollShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-[100dvh] w-full flex-col px-6 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function PageStickyHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`sticky top-0 z-10 -mx-6 mb-2 bg-gray-50/90 px-6 pb-2 ${PAGE_TOP_PADDING} backdrop-blur-xl ${className}`.trim()}
    >
      {children}
    </header>
  );
}
