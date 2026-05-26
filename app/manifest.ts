import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "오늘의 말씀",
    short_name: "오늘의 말씀",
    description: "말씀으로 하루를 시작하는 설교 앱",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#818cf8",
    lang: "ko",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
