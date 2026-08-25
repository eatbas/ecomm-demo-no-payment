import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

function Toast({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className={cn(
        "flex w-full max-w-sm items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-card-foreground shadow-lg animate-toast-in motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

function ToastIndicator({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground",
        className,
      )}
      {...props}
    />
  );
}

function ToastTitle({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function ToastDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("mt-1 text-sm leading-6 text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Toast, ToastDescription, ToastIndicator, ToastTitle };
