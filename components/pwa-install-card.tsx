"use client";

import { useCallback, useEffect, useState } from "react";
import { Smartphone } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallGuide =
  | "ios-safari"
  | "android-chrome"
  | "need-safari"
  | "need-chrome"
  | "in-app"
  | "other";

function detectInstallGuide(): InstallGuide {
  if (typeof navigator === "undefined") {
    return "other";
  }

  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isInApp =
    /KAKAOTALK|Instagram|FB_IAB|FBAV|FBAN|Line\/|NAVER\(inapp|; wv\)/i.test(
      ua,
    );

  if (isInApp) {
    return "in-app";
  }

  if (isIOS) {
    const isSafari =
      /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
    return isSafari ? "ios-safari" : "need-safari";
  }

  if (isAndroid) {
    const isChrome =
      /Chrome/i.test(ua) && !/EdgA|SamsungBrowser|OPR/i.test(ua);
    return isChrome ? "android-chrome" : "need-chrome";
  }

  return "other";
}

function getTapFeedback(guide: InstallGuide): string {
  switch (guide) {
    case "ios-safari":
      return "공유 버튼(□↑) → 「홈 화면에 추가」 → 「추가」를 눌러주세요.";
    case "android-chrome":
      return "설치 창이 안 뜨면 Chrome 메뉴(⋮)에서 「앱 설치」를 확인하거나, 잠시 후 이 카드를 다시 눌러주세요.";
    case "need-safari":
      return "Safari에서 이 페이지를 연 뒤, 공유 → 「홈 화면에 추가」를 선택해주세요.";
    case "need-chrome":
      return "Chrome에서 이 페이지를 연 뒤, 이 카드를 다시 눌러주세요.";
    case "in-app":
      return "⋯ 메뉴에서 Safari 또는 Chrome으로 열어주세요.";
    default:
      return "휴대폰 Chrome 또는 Safari에서 이 카드를 눌러주세요.";
  }
}

export function PwaInstallCard() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [installGuide, setInstallGuide] = useState<InstallGuide>("other");

  useEffect(() => {
    setInstallGuide(detectInstallGuide());

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

  const handleClick = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return;
    }

    setFeedback(getTapFeedback(installGuide));
    window.setTimeout(() => setFeedback(null), 6000);
  }, [deferredPrompt, installGuide]);

  if (isInstalled) {
    return null;
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => void handleClick()}
        className="relative block h-fit w-full rounded-3xl bg-gradient-to-br from-orange-50 to-amber-100 p-6 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
      >
        <div className="absolute right-6 top-4 flex size-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Smartphone className="size-6 text-orange-500" strokeWidth={2} />
        </div>

        <div className="flex flex-col items-start pr-14">
          <h2 className="text-lg font-bold text-foreground">홈 화면에 추가</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Chrome, Safari에서 눌러주세요
          </p>
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
