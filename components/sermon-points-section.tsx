"use client";

import { ListOrdered } from "lucide-react";
import { CollapsibleSection } from "@/components/collapsible-section";
import { YoutubeListenLink } from "@/components/youtube-listen-link";
import {
  buildYoutubeDeepLink,
  type NormalizedSermonPoint,
} from "@/lib/sermon-parse";

function SermonPointCard({
  point,
  videoId,
}: {
  point: NormalizedSermonPoint;
  videoId: string;
}) {
  const youtubeHref = buildYoutubeDeepLink(videoId, point.start_seconds);
  const timeLabel = point.start_time || "00:00";

  return (
    <blockquote className="relative overflow-hidden rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-rose-100/80">
      <ListOrdered
        className="pointer-events-none absolute left-4 top-4 size-6 text-rose-200"
        strokeWidth={1.5}
        aria-hidden
      />
      <h4 className="pl-10 pr-2 text-base font-semibold leading-snug text-gray-900">
        {point.point_title}
      </h4>
      <p className="mt-2 pl-10 pr-2 text-sm leading-relaxed text-gray-800">
        {point.description}
      </p>
      {youtubeHref ? (
        <div className="mt-5 flex justify-end">
          <YoutubeListenLink
            href={youtubeHref}
            timeLabel={timeLabel}
            className="inline-flex rounded-full bg-rose-100 px-3.5 py-1.5 text-xs font-semibold text-rose-900 transition-colors hover:bg-rose-200/90 active:scale-95"
            ariaLabel={`${point.point_title} — ${timeLabel}부터 유튜브에서 듣기`}
          />
        </div>
      ) : null}
    </blockquote>
  );
}

type SermonPointsSectionProps = {
  points: NormalizedSermonPoint[];
  videoId: string;
};

export function SermonPointsSection({ points, videoId }: SermonPointsSectionProps) {
  const hasPoints = points.length > 0;

  return (
    <CollapsibleSection
      alwaysOpen
      title="설교 포인트"
      icon={
        <ListOrdered
          className="size-5 shrink-0 text-rose-300"
          strokeWidth={1.75}
          aria-hidden
        />
      }
      sectionClassName="rounded-3xl bg-rose-50 shadow-sm ring-1 ring-rose-100/60"
      borderClassName="border-rose-100/60"
      hintClassName="text-rose-800/70"
      chevronClassName="text-rose-700/70"
      buttonHoverClassName="hover:bg-rose-100/40"
      titleClassName="text-rose-900/80"
    >
      {hasPoints ? (
        <div className="flex flex-col gap-4">
          {points.map((point, idx) => (
            <SermonPointCard
              key={`${point.start_seconds}-${point.point_title}-${idx}`}
              point={point}
              videoId={videoId}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-white/70 p-4 text-sm leading-relaxed text-gray-600 ring-1 ring-rose-100/80">
          등록된 설교 포인트가 없습니다.
        </p>
      )}
    </CollapsibleSection>
  );
}
