"use client";

import { useEffect } from "react";

export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // 설치 유도에 필수는 아니며, 등록 실패 시 앱 동작은 그대로 유지
    });
  }, []);

  return null;
}
