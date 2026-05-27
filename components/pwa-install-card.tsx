"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, Share, Smartphone } from "lucide-react";
import {
  buildAndroidChromeIntentUrl,
  getExternalBrowserTarget,
  isAndroid,
  isChromeBrowser,
  isInAppBrowser,
  isIOS,
  isSafariBrowser,
  openInSafari,
} from "@/lib/open-external-browser";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallMode =
  | "open-external"
  | "install-ready"
  | "install-hint"
  | "hidden";

type DevicePlatform = "ios" | "android" | "other";

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
  const inApp = isInAppBrowser(ua);

  if (inApp) {
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
    return "설치 창이 안 뜨면 Chrome 메뉴(⋮) → 「앱 설치」 또는 이 카드를 다시 눌러주세요.";
  }
  return "휴대폰 Chrome 또는 Safari에서 이 카드를 눌러주세요.";
}

function KakaoOpenHint({ platform }: { platform: DevicePlatform }) {
  if (platform === "ios") {
    return (
      <div
        className="mt-3 rounded-2xl border border-orange-200/80 bg-white/90 px-3 py-3"
        aria-hidden
      >
        <p className="mb-2 text-center text-[11px] text-muted-foreground">
          이렇게 나오면 <span className="font-semibold text-orange-600">열기</span>
          를 눌러주세요
        </p>
        <div className="flex justify-center gap-1.5">
          <span className="rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
            바로가기
          </span>
          <span className="rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
            둘러보기
          </span>
          <span className="rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm">
            열기
          </span>
        </div>
      </div>
    );
  }

  if (platform === "android") {
    return (
      <div
        className="mt-3 rounded-2xl border border-orange-200/80 bg-white/90 px-3 py-3"
        aria-hidden
      >
        <p className="mb-2 text-center text-[11px] text-muted-foreground">
          이렇게 나오면{" "}
          <span className="font-semibold text-orange-600">Chrome에서 열기</span>
          또는 <span className="font-semibold text-orange-600">열기</span>를
          눌러주세요
        </p>
        <div className="flex justify-center gap-1.5">
          <span className="rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
            둘러보기
          </span>
          <span className="rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm">
            Chrome에서 열기
          </span>
        </div>
      </div>
    );
  }

  return null;
}

function InstallStepHint({ platform }: { platform: DevicePlatform }) {
  if (platform === "ios") {
    return (
      <div
        className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-orange-200/80 bg-white/90 px-3 py-3"
        aria-hidden
      >
        <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5 text-xs text-muted-foreground">
          <Share className="size-3.5" aria-hidden />
          공유
        </span>
        <span className="text-xs text-muted-foreground">→</span>
        <span className="rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm">
          홈 화면에 추가
        </span>
      </div>
    );
  }

  if (platform === "android") {
    return (
      <div
        className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-orange-200/80 bg-white/90 px-3 py-3"
        aria-hidden
      >
        <span className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm">
          <Download className="size-3.5" aria-hidden />
          다운로드 / 앱 설치
        </span>
      </div>
    );
  }

  return null;
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

  const handleSafariOpen = useCallback(() => {
    if (!pageUrl) {
      return;
    }
    openInSafari(pageUrl);
    setFeedback(
      "Safari가 안 열리면 ⋯ 메뉴에서 「Safari에서 열기」 또는 「다른 브라우저로 열기」를 눌러주세요.",
    );
    window.setTimeout(() => setFeedback(null), 10000);
  }, [pageUrl]);

  if (isInstalled) {
    return null;
  }

  const externalTarget = getExternalBrowserTarget();
  const androidIntentUrl = pageUrl ? buildAndroidChromeIntentUrl(pageUrl) : "#";
  const isSafariTarget = externalTarget === "safari";

  if (mode === "open-external") {
    return (
      <div className="w-full">
        <div className="relative w-full rounded-3xl bg-gradient-to-br from-orange-50 to-amber-100 p-6 shadow-sm">
          <div className="absolute right-6 top-4 flex size-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
            <ExternalLink className="size-6 text-orange-500" strokeWidth={2} />
          </div>

          <div className="flex flex-col items-start pr-14">
            <h2 className="text-lg font-bold text-foreground">앱 설치하기</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              카카오톡에서는 설치가 안 돼요.
              <br />
              {platform === "ios"
                ? "아래를 누른 뒤 열기 버튼을 눌러주세요."
                : platform === "android"
                  ? "아래를 누른 뒤 Chrome에서 열기(또는 열기)를 눌러주세요."
                  : "아래를 누른 뒤 열기 버튼을 눌러주세요."}
            </p>
            <KakaoOpenHint platform={platform} />
          </div>

          <div className="mt-4">
            {isSafariTarget ? (
              <button
                type="button"
                onClick={handleSafariOpen}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition active:scale-[0.99]"
              >
                앱 설치하기
              </button>
            ) : (
              <a
                href={androidIntentUrl}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-orange-500 px-4 py-3.5 text-base font-semibold text-white shadow-sm transition active:scale-[0.99]"
              >
                앱 설치하기
              </a>
            )}
          </div>
        </div>
        {feedback ? (
          <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
            {feedback}
          </p>
        ) : null}
      </div>
    );
  }

  const installTitle =
    platform === "android" ? "앱 설치하기" : "홈 화면에 추가하기";
  const installDescription =
    platform === "ios"
      ? "이제 홈 화면에 추가할 수 있어요"
      : platform === "android"
        ? "이제 다운로드(설치)할 수 있어요"
        : mode === "install-ready"
          ? "아래를 눌러 바로 추가할 수 있어요"
          : "Chrome 또는 Safari에서 눌러주세요";

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => void handleInstallClick()}
        className="relative block h-fit w-full rounded-3xl bg-gradient-to-br from-orange-50 to-amber-100 p-6 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
      >
        <div className="absolute right-6 top-4 flex size-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Smartphone className="size-6 text-orange-500" strokeWidth={2} />
        </div>

        <div className="flex w-full flex-col items-start pr-14">
          <h2 className="text-lg font-bold text-foreground">{installTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {installDescription}
          </p>
          {(platform === "ios" || platform === "android") &&
          mode === "install-ready" ? (
            <InstallStepHint platform={platform} />
          ) : null}
        </div>
      </button>
      {feedback ? (
        <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
