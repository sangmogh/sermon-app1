"use client";

import { Quote } from "lucide-react";
import { CollapsibleSection } from "@/components/collapsible-section";
import { YoutubeListenLink } from "@/components/youtube-listen-link";
import { type NormalizedGraceNote } from "@/lib/sermon-parse";

function GraceNoteCard({
  note,
  videoId,
}: {
  note: NormalizedGraceNote;
  videoId: string;
}) {
  const hasVideo = Boolean(videoId.trim());
  const timeLabel = note.start_time || "00:00";

  return (
    <blockquote className="relative overflow-hidden rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-indigo-100/80">
      <Quote
        className="pointer-events-none absolute left-4 top-4 size-6 text-indigo-200"
        strokeWidth={1.5}
        aria-hidden
      />
      <p className="pl-10 pr-2 text-sm leading-relaxed text-gray-800">
        {note.quote}
      </p>
      {hasVideo ? (
        <YoutubeListenLink
          videoId={videoId}
          startSeconds={note.start_seconds}
          timeLabel={timeLabel}
          className="inline-flex rounded-full bg-indigo-100 px-3.5 py-1.5 text-xs font-semibold text-indigo-800 transition-colors hover:bg-indigo-200/90 active:scale-95"
          ariaLabel={`${timeLabel}부터 유튜브에서 듣기`}
        />
      ) : null}
    </blockquote>
  );
}

type GraceNotesSectionProps = {
  notes: NormalizedGraceNote[];
  videoId: string;
};

export function GraceNotesSection({ notes, videoId }: GraceNotesSectionProps) {
  const hasNotes = notes.length > 0;

  return (
    <CollapsibleSection
      title="은혜의 조각들"
      icon={
        <Quote
          className="size-5 shrink-0 text-indigo-300"
          strokeWidth={1.75}
          aria-hidden
        />
      }
      sectionClassName="rounded-3xl bg-indigo-50 shadow-sm ring-1 ring-indigo-100/60"
      borderClassName="border-indigo-100/60"
      hintClassName="text-indigo-800/70"
      chevronClassName="text-indigo-700/70"
      buttonHoverClassName="hover:bg-indigo-100/40"
      titleClassName="text-indigo-900/80"
    >
      {hasNotes ? (
        <div className="flex flex-col gap-4">
          {notes.map((note, idx) => (
            <GraceNoteCard
              key={`${note.start_seconds}-${note.quote.slice(0, 24)}-${idx}`}
              note={note}
              videoId={videoId}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-white/70 p-4 text-sm leading-relaxed text-gray-600 ring-1 ring-indigo-100/80">
          은혜의 조각들 데이터가 없습니다.
        </p>
      )}
    </CollapsibleSection>
  );
}
