import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "오늘의 말씀",
    short_name: "오늘의 말씀",
    description: "말씀으로 하루를 시작하는 설교 앱",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#3b82f6",
    lang: "ko",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/app-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
