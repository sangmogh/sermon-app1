"use client";

import { useCallback, useEffect, useState } from "react";
import { Smartphone } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaInstallCard() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
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

    setFeedback("Chrome에서 이 주소를 연 뒤 다시 눌러주세요.");
    window.setTimeout(() => setFeedback(null), 4000);
  }, [deferredPrompt]);

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
        <div className="absolute right-6 top-6 flex size-10 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
          <Smartphone className="size-6 text-orange-500" strokeWidth={2} />
        </div>

        <div className="flex flex-col items-start pr-14">
          <h2 className="text-lg font-bold text-foreground">홈 화면에 추가</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Chrome으로 열어야만 가능해요
          </p>
        </div>
      </button>
      {feedback ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
