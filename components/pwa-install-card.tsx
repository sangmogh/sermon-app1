"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Smartphone } from "lucide-react";
import {
  buildAndroidChromeIntentUrl,
  copyPageUrl,
  isAndroid,
  isChromeBrowser,
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

type AccentChipKind = "open" | "copy" | "download";

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
  if (isInAppBrowser(ua)) {
    return "open-external";
  }
  if (isIOS(ua)) {
    return isSafariBrowser(ua) ? "install-ready" : "open-external";
  }
  if (isAndroid(ua)) {
    return isChromeBrowser(ua) ? "install-ready" : "open-external";
  }
  return "install-hint";
}

function getInstallHint(platform: DevicePlatform): string {
  if (platform === "ios") {
    return "하단 공유(□↑) → 「홈 화면에 추가」 → 「추가」";
  }
  if (platform === "android") {
    return "설치 창이 안 뜨면 Chrome 메뉴(⋮) → 「앱 설치」를 눌러주세요.";
  }
  return "휴대폰 Chrome 또는 Safari에서 열어주세요.";
}

const CHIP_MUTED =
  "rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground";
const CHIP_ACCENT =
  "rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm";

function ChipHintRow({
  subtitle,
  accentKind,
  accentHref,
  onAccentClick,
}: {
  subtitle: string;
  accentKind: AccentChipKind;
  accentHref?: string;
  onAccentClick?: () => void;
}) {
  const accentLabel =
    accentKind === "open"
      ? "열기"
      : accentKind === "copy"
        ? "주소복사"
        : "다운로드";

  const accentNode =
    accentHref !== undefined ? (
      <a
        href={accentHref}
        className={`${CHIP_ACCENT} shrink-0 transition active:scale-[0.98]`}
        onClick={(event) => event.stopPropagation()}
      >
        {accentLabel}
      </a>
    ) : (
      <button
        type="button"
        className={`${CHIP_ACCENT} shrink-0 transition active:scale-[0.98]`}
        onClick={(event) => {
          event.stopPropagation();
          onAccentClick?.();
        }}
      >
        {accentLabel}
      </button>
    );

  return (
    <div className="mt-2 w-full">
      <p className="text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" aria-hidden>
          <span className={CHIP_MUTED}>바로가기</span>
          <span className={CHIP_MUTED}>둘러보기</span>
        </div>
        {accentNode}
      </div>
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
      <div className="flex flex-col items-start pr-14">{children}</div>
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

  if (isInstalled) {
    return null;
  }

  if (platform === "other" && mode === "install-hint") {
    return null;
  }

  const androidIntentUrl = pageUrl ? buildAndroidChromeIntentUrl(pageUrl) : "#";

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
          <h2 className="text-lg font-bold text-foreground">앱 설치하기</h2>
          {isIos ? (
            <ChipHintRow
              subtitle="safari에서 열어주세요"
              accentKind="copy"
              onAccentClick={() => void handleCopyLink()}
            />
          ) : (
            <ChipHintRow
              subtitle="열기 버튼을 눌러주세요"
              accentKind="open"
              accentHref={androidIntentUrl}
            />
          )}
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
          <h2 className="text-lg font-bold text-foreground">앱 설치하기</h2>
          <ChipHintRow
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
      <InstallCardShell icon={Smartphone}>
        <h2 className="text-lg font-bold text-foreground">앱 설치하기</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Chrome 또는 Safari에서 열어주세요
        </p>
      </InstallCardShell>
    </div>
  );
}
