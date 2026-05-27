/** 카카오·인스타 등 인앱 브라우저(WebView) 감지 */
export function isInAppBrowser(userAgent = ""): boolean {
  return /KAKAOTALK|Instagram|FB_IAB|FBAV|FBAN|Line\/|NAVER\(inapp|; wv\)/i.test(
    userAgent,
  );
}

export function isKakaoTalk(userAgent = ""): boolean {
  return /KAKAOTALK/i.test(userAgent);
}

/** iOS 인앱(WebView)에서는 window.open 이 Safari로 나가지 않고 같은 앱 안에서만 다시 열림 */
export function needsIosInAppManualBrowser(userAgent = ""): boolean {
  return isIOS(userAgent) && isInAppBrowser(userAgent);
}

export function isIOS(userAgent = ""): boolean {
  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (typeof navigator !== "undefined" &&
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1)
  );
}

export function isAndroid(userAgent = ""): boolean {
  return /Android/i.test(userAgent);
}

export function isSafariBrowser(userAgent = ""): boolean {
  return /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
}

export function isChromeBrowser(userAgent = ""): boolean {
  return /Chrome/i.test(userAgent) && !/EdgA|SamsungBrowser|OPR/i.test(userAgent);
}

/** Android: Chrome으로 HTTPS 페이지 열기 (인앱 WebView에서 링크 탭 시 동작) */
export function buildAndroidChromeIntentUrl(pageUrl: string): string {
  const withoutProtocol = pageUrl.replace(/^https?:\/\//i, "");
  const fallback = encodeURIComponent(pageUrl);
  return `intent://${withoutProtocol}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

export type ExternalBrowserTarget = "chrome" | "safari";

export function getExternalBrowserTarget(
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
): ExternalBrowserTarget | null {
  if (isIOS(userAgent)) {
    return "safari";
  }
  if (isAndroid(userAgent)) {
    return "chrome";
  }
  return null;
}

/** iOS 일반 브라우저(Chrome 등)에서 Safari 유도용 — 카카오 인앱에서는 사용하지 말 것 */
export function openInSafari(pageUrl: string): void {
  const opened = window.open(pageUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.assign(pageUrl);
  }
}

export async function copyPageUrl(pageUrl: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(pageUrl);
      return true;
    }
  } catch {
    // fallback below
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = pageUrl;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
