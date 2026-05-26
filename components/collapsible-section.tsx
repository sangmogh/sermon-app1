"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type CollapsibleSectionProps = {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  sectionClassName: string;
  borderClassName: string;
  hintClassName: string;
  chevronClassName: string;
  buttonHoverClassName: string;
  titleClassName?: string;
  /** true면 접기 없이 항상 펼침 (설교 포인트·결단의 기도) */
  alwaysOpen?: boolean;
};

export function CollapsibleSection({
  title,
  icon,
  children,
  sectionClassName,
  borderClassName,
  hintClassName,
  chevronClassName,
  buttonHoverClassName,
  titleClassName = "text-foreground",
  alwaysOpen = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(alwaysOpen);
  const expanded = alwaysOpen || isOpen;

  return (
    <section className={sectionClassName}>
      {alwaysOpen ? (
        <div className="flex w-full items-center gap-2 p-6 pb-4">
          {icon}
          <h3
            className={`text-sm font-semibold tracking-tight ${titleClassName}`}
          >
            {title}
          </h3>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex w-full items-center justify-between gap-3 p-6 text-left transition-colors active:scale-[0.99] ${buttonHoverClassName}`}
          aria-expanded={expanded}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {icon}
            <h3
              className={`text-sm font-semibold tracking-tight ${titleClassName}`}
            >
              {title}
            </h3>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={`text-xs font-medium ${hintClassName}`}>
              눌러서 펼쳐보세요
            </span>
            <ChevronDown
              className={`size-5 shrink-0 transition-transform duration-200 ${chevronClassName} ${
                expanded ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </div>
        </button>
      )}

      {expanded ? (
        <div
          className={`px-6 pb-6 ${alwaysOpen ? "pt-0" : `border-t pt-1 ${borderClassName}`}`}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
