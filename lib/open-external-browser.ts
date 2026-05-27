/** 카카오·인스타 등 인앱 브라우저(WebView) 감지 */
export function isInAppBrowser(userAgent = ""): boolean {
  return /KAKAOTALK|Instagram|FB_IAB|FBAV|FBAN|Line\/|NAVER\(inapp|; wv\)/i.test(
    userAgent,
  );
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

/** iOS: 새 창으로 열기 시도 (인앱 브라우저에 따라 Safari로 넘어가는 경우 있음) */
export function openInSafari(pageUrl: string): void {
  const opened = window.open(pageUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.assign(pageUrl);
  }
}
