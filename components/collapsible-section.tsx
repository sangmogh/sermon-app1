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
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className={sectionClassName}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-3 p-6 text-left transition-colors active:scale-[0.99] ${buttonHoverClassName}`}
        aria-expanded={isOpen}
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
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </div>
      </button>

      {isOpen ? (
        <div className={`border-t px-6 pb-6 pt-1 ${borderClassName}`}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
