import { BackLink } from "@/components/back-link";
import { HomeLink } from "@/components/home-link";

type PageTopBarProps = {
  /** false면 왼쪽 자리만 맞추고 뒤로가기 숨김 (홈) */
  showBack?: boolean;
  backHref?: string;
};

/** 모든 화면 우측 상단 홈 버튼 동일 높이·위치 */
export function PageTopBar({ showBack = true, backHref = "/" }: PageTopBarProps) {
  return (
    <div className="flex h-11 w-full items-center justify-between">
      {showBack ? (
        <BackLink href={backHref} />
      ) : (
        <div className="size-11 shrink-0" aria-hidden />
      )}
      <HomeLink />
    </div>
  );
}
