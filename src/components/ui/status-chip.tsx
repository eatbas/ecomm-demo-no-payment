import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type StatusChipTone = "positive" | "neutral";

interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: StatusChipTone;
}

export function StatusChip({
  className,
  tone = "neutral",
  ...props
}: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full px-3 py-1 text-xs font-bold tracking-wide",
        tone === "positive"
          ? "bg-emerald-100 text-emerald-900"
          : "bg-secondary text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}
