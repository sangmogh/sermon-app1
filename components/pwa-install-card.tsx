"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Smartphone } from "lucide-react";
import {
  buildAndroidChromeIntentUrl,
  copyPageUrl,
  isAndroid,
  isInAppBrowser,
  isIOS,
  isSafariBrowser,
} from "@/lib/open-external-browser";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallMode = "open-external" | "install-ready" | "install-hint";

type DevicePlatform = "ios" | "android" | "other";

type AccentPillKind = "open" | "copy" | "download";

/** page.tsx 둘러보기 pill 과 동일 패딩·타이포; 주황 3종 동일 너비·한 줄 */
const ORANGE_PILL_CLASS =
  "box-border inline-flex w-[5.85rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full border-0 bg-orange-500 px-4 py-1.5 text-sm font-semibold leading-none text-white transition active:scale-[0.98]";

const CARD_TITLE_CLASS = "pr-14 text-lg font-bold text-foreground";

function detectPlatform(): DevicePlatform {
  if (typeof navigator === "undefined") {
    return "other";
  }
  const ua = navigator.userAgent;
  if (isIOS(ua)) {
    return "ios";
  }
  if (isAndroid(ua)) {
    return "android";
  }
  return "other";
}

function detectInstallMode(): InstallMode {
  if (typeof navigator === "undefined") {
    return "install-hint";
  }

  const ua = navigator.userAgent;
  // 인앱 브라우저(카카오·네이버앱 등)는 PWA 설치가 막혀 있어 외부 브라우저로 유도.
  if (isInAppBrowser(ua)) {
    return "open-external";
  }
  // iOS는 Safari만 홈 화면 추가 가능. 그 외(iOS Chrome 등)는 Safari로 유도.
  if (isIOS(ua)) {
    return isSafariBrowser(ua) ? "install-ready" : "open-external";
  }
  // 안드로이드 일반 브라우저(Chrome·삼성·Edge·Opera·웨일·Firefox 등)는 모두 설치 시도.
  // 설치 가능 브라우저는 beforeinstallprompt 가 떠서 deferredPrompt 로 바로 설치되고,
  // 미지원(Firefox 등)은 클릭 시 수동 안내 힌트로 안전하게 떨어진다.
  // → Chrome Intent 강제 이동을 제거해 삼성 인터넷 무한루프를 근본 차단.
  if (isAndroid(ua)) {
    return "install-ready";
  }
  return "install-hint";
}

function getInstallHint(platform: DevicePlatform): string {
  if (platform === "ios") {
    return "하단 공유(□↑) → 「홈 화면에 추가」 → 「추가」";
  }
  if (platform === "android") {
    return "설치 창이 안 뜨면 브라우저 메뉴(⋮)에서 「앱 설치」 또는 「홈 화면에 추가」를 눌러주세요.";
  }
  return "휴대폰 Chrome 또는 Safari에서 열어주세요.";
}

function InstallCardActionRow({
  subtitle,
  accentKind,
  onAccentClick,
}: {
  subtitle: string;
  accentKind: AccentPillKind;
  onAccentClick?: () => void;
}) {
  const accentLabel =
    accentKind === "open"
      ? "열기"
      : accentKind === "copy"
        ? "주소복사"
        : "다운로드";

  const pill = (
    <button
      type="button"
      className={ORANGE_PILL_CLASS}
      onClick={(event) => {
        event.stopPropagation();
        onAccentClick?.();
      }}
    >
      {accentLabel}
    </button>
  );

  return (
    <div className="mt-3 flex w-full flex-nowrap items-center justify-between gap-3">
      <p className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-snug text-muted-foreground">
        {subtitle}
      </p>
      {pill}
    </div>
  );
}

function InstallCardShell({
  icon: Icon,
  children,
  onCardClick,
  asButton = false,
}: {
  icon: typeof ExternalLink;
  children: ReactNode;
  onCardClick?: () => void;
  asButton?: boolean;
}) {
  const className =
    "relative block h-fit w-full rounded-3xl bg-gradient-to-br from-orange-50 to-amber-100 p-6 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99]";

  const inner = (
    <>
      <div className="absolute right-6 top-4 flex size-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
        <Icon className="size-6 text-orange-500" strokeWidth={2} />
      </div>
      <div className="flex w-full flex-col">{children}</div>
    </>
  );

  if (asButton) {
    return (
      <button type="button" onClick={onCardClick} className={className}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function PwaInstallCard() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mode, setMode] = useState<InstallMode>("install-hint");
  const [platform, setPlatform] = useState<DevicePlatform>("other");
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    setPageUrl(window.location.href);
    setPlatform(detectPlatform());
    setMode(detectInstallMode());

    const standalone = window.matchMedia(
      "(display-mode: standalone)",
    ).matches;
    const iosStandalone =
      "standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone;

    if (standalone || iosStandalone) {
      setIsInstalled(true);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }

    setFeedback(getInstallHint(platform));
    window.setTimeout(() => setFeedback(null), 8000);
  }, [deferredPrompt, platform]);

  const handleCopyLink = useCallback(async () => {
    if (!pageUrl) {
      return;
    }
    const ok = await copyPageUrl(pageUrl);
    setFeedback(
      ok
        ? "주소가 복사됐어요. Safari 주소창에 붙여넣기 해 주세요."
        : "복사에 실패했어요. ⋯ 메뉴에서 Safari에서 열기를 눌러주세요.",
    );
    window.setTimeout(() => setFeedback(null), 8000);
  }, [pageUrl]);

  const openInAndroidChrome = useCallback(() => {
    if (!pageUrl) {
      return;
    }
    window.location.assign(buildAndroidChromeIntentUrl(pageUrl));
  }, [pageUrl]);

  if (isInstalled) {
    return null;
  }

  const feedbackLine = feedback ? (
    <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
      {feedback}
    </p>
  ) : null;

  if (mode === "open-external") {
    const isIos = platform === "ios";

    return (
      <div className="w-full">
        <InstallCardShell icon={ExternalLink}>
          <h2 className={CARD_TITLE_CLASS}>앱 설치하기</h2>
          <InstallCardActionRow
            subtitle={
              isIos ? "safari에서 열어주세요" : "열기 버튼을 눌러주세요"
            }
            accentKind={isIos ? "copy" : "open"}
            onAccentClick={() =>
              void (isIos ? handleCopyLink() : openInAndroidChrome())
            }
          />
        </InstallCardShell>
        {feedbackLine}
      </div>
    );
  }

  if (mode === "install-ready") {
    return (
      <div className="w-full">
        <InstallCardShell
          icon={Smartphone}
          asButton
          onCardClick={() => void handleInstallClick()}
        >
          <h2 className={CARD_TITLE_CLASS}>앱 설치하기</h2>
          <InstallCardActionRow
            subtitle="이제 다운로드할 수 있어요"
            accentKind="download"
            onAccentClick={() => void handleInstallClick()}
          />
        </InstallCardShell>
        {feedbackLine}
      </div>
    );
  }

  return (
    <div className="w-full">
      <InstallCardShell
        icon={Smartphone}
        asButton
        onCardClick={() => void handleInstallClick()}
      >
        <h2 className={CARD_TITLE_CLASS}>홈 화면에 추가</h2>
        <p className="mt-3 text-sm leading-snug text-muted-foreground">
          {deferredPrompt
            ? "아래를 눌러 바로 추가할 수 있어요"
            : "Chrome 또는 Safari에서 눌러주세요"}
        </p>
      </InstallCardShell>
      {feedbackLine}
    </div>
  );
}
