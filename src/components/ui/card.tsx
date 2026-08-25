import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type CardTitleLevel = 2 | 3 | 4 | 5 | 6;

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  readonly level?: CardTitleLevel;
}

const cardTitleElements = {
  2: "h2",
  3: "h3",
  4: "h4",
  5: "h5",
  6: "h6",
} as const;

function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-2 p-6", className)} {...props} />;
}

function CardTitle({ className, level = 3, ...props }: CardTitleProps) {
  const Heading = cardTitleElements[level];

  return (
    <Heading
      className={cn("text-xl font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />
  );
}

function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pb-6", className)} {...props} />;
}

function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center px-6 pb-6", className)} {...props} />
  );
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
