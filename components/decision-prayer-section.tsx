"use client";

import { HeartHandshake, Play } from "lucide-react";
import { CollapsibleSection } from "@/components/collapsible-section";
import {
  buildYoutubeDeepLink,
  type NormalizedDecisionPrayer,
} from "@/lib/sermon-parse";

type DecisionPrayerSectionProps = {
  prayer: NormalizedDecisionPrayer | null;
  videoId: string;
};

export function DecisionPrayerSection({
  prayer,
  videoId,
}: DecisionPrayerSectionProps) {
  const hasPrayer = prayer !== null && prayer.prayer_text.trim().length > 0;
  const youtubeHref = prayer
    ? buildYoutubeDeepLink(videoId, prayer.start_seconds)
    : null;
  const timeLabel = prayer?.start_time || "듣기";

  return (
    <CollapsibleSection
      title="결단의 기도"
      icon={
        <HeartHandshake
          className="size-5 shrink-0 text-amber-600/80"
          strokeWidth={1.75}
          aria-hidden
        />
      }
      sectionClassName="rounded-3xl bg-amber-50/90 shadow-sm ring-1 ring-amber-100/80"
      borderClassName="border-amber-100/80"
      hintClassName="text-amber-800/70"
      chevronClassName="text-amber-700/70"
      buttonHoverClassName="hover:bg-amber-100/40"
      titleClassName="text-amber-900/85"
    >
      {hasPrayer && prayer ? (
        <div className="rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-amber-100/80">
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">
            {prayer.prayer_text}
          </p>
          {youtubeHref ? (
            <div className="mt-5 flex justify-end">
              <a
                href={youtubeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-200/90 active:scale-95"
                aria-label={`결단의 기도 ${timeLabel}부터 유튜브에서 듣기`}
              >
                <Play className="size-3.5 shrink-0" fill="currentColor" />
                {timeLabel}부터 듣기
              </a>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl bg-white/70 p-4 text-sm leading-relaxed text-gray-600 ring-1 ring-amber-100/80">
          결단의 기도가 아직 비어있습니다.
        </p>
      )}
    </CollapsibleSection>
  );
}
