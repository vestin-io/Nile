import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn";

export function Empty({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex w-full flex-col gap-6", className)} {...props} />;
}

export function EmptyHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col items-center gap-3 text-center", className)} {...props} />;
}

type EmptyMediaProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "icon";
};

export function EmptyMedia({ className, variant = "default", ...props }: EmptyMediaProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full",
        variant === "icon" && "h-14 w-14 border bg-background/80 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-xl font-semibold tracking-tight", className)} {...props} />;
}

export function EmptyDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("max-w-2xl text-sm text-muted-foreground", className)} {...props} />;
}

export function EmptyContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-4", className)} {...props} />;
}
