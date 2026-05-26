import Link from "next/link";
import { Clock } from "lucide-react";
import type { Sermon } from "@/lib/supabase";
import {
  formatSermonDateLabel,
  formatSermonDayNumber,
  formatSermonMonthShort,
  groupSermonsByMonth,
  hasValidSermonDate,
} from "@/lib/archive";
import { parseKeywords } from "@/lib/sermon-parse";

type ArchiveMonthListProps = {
  sermons: Sermon[];
  emptyMessage?: string;
};

export function ArchiveMonthList({
  sermons,
  emptyMessage = "이 연도에 보관된 설교가 없습니다.",
}: ArchiveMonthListProps) {
  const monthGroups = groupSermonsByMonth(sermons);

  if (monthGroups.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-8 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {monthGroups.map((group) => (
        <section key={group.label}>
          <div className="mb-3 flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-muted-foreground">
              {group.label}
            </h2>
          </div>

          <div className="relative flex flex-col gap-3">
            <div className="absolute bottom-2 left-[23px] top-2 w-px bg-border" />

            {group.sermons.map((sermon) => {
              const keywords = parseKeywords(sermon.keywords);
              const dayNumber = formatSermonDayNumber(sermon);
              const monthShort = formatSermonMonthShort(sermon);
              const dateLabel = formatSermonDateLabel(sermon);
              const showDate = hasValidSermonDate(sermon);

              return (
                <Link
                  key={sermon.id}
                  href={`/sermon/${sermon.id}`}
                  className="relative flex items-center gap-4 rounded-2xl bg-card p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
                >
                  {showDate && dayNumber ? (
                    <div className="relative z-[1] flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10">
                      <span className="text-lg font-bold leading-none text-primary">
                        {dayNumber}
                      </span>
                      {monthShort ? (
                        <span className="mt-0.5 text-[10px] font-medium text-primary/80">
                          {monthShort}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="min-w-0 flex-1">
                    {showDate ? (
                      <span className="text-xs font-medium text-muted-foreground">
                        {dateLabel}
                      </span>
                    ) : null}
                    <h3 className="mt-1 text-base font-semibold text-foreground">
                      {sermon.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {sermon.core_bible_verse}
                    </p>
                    {keywords.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {keywords.slice(0, 3).map((keyword, idx) => (
                          <span
                            key={`${keyword}-${idx}`}
                            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            #{keyword}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
