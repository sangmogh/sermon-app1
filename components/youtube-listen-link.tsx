"use client";

import { useId, useState } from "react";
import { buildYoutubeEmbedUrl } from "@/lib/sermon-parse";

/** 유니코드에 공식 YouTube 이모지 없음 — ▶ 사용 */
const YOUTUBE_PLAY_MARK = "▶";

export function formatYoutubeListenLabel(timeLabel: string): string {
  const time = timeLabel.trim() || "00:00";
  return `${YOUTUBE_PLAY_MARK} ${time}부터 유튜브로 듣기`;
}

type YoutubeListenLinkProps = {
  videoId: string;
  startSeconds: number;
  timeLabel: string;
  className: string;
  ariaLabel: string;
};

export function YoutubeListenLink({
  videoId,
  startSeconds,
  timeLabel,
  className,
  ariaLabel,
}: YoutubeListenLinkProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const embedSrc = buildYoutubeEmbedUrl(videoId, startSeconds);

  if (!embedSrc) {
    return null;
  }

  return (
    <div className="mt-5 w-full">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={className}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={ariaLabel}
        >
          {formatYoutubeListenLabel(timeLabel)}
        </button>
      </div>
      {open ? (
        <div
          id={panelId}
          className="mt-3 w-full overflow-hidden rounded-2xl bg-black shadow-md ring-1 ring-black/10"
        >
          <div className="relative aspect-video w-full">
            <iframe
              src={embedSrc}
              title={`${timeLabel}부터 재생`}
              className="absolute inset-0 h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
