import type { HTMLAttributes } from "react";

import { cn } from "./cn";

type ProgressProps = HTMLAttributes<HTMLDivElement> & {
  value: number;
};

export function Progress({ className, value, ...props }: ProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn("h-2 overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        className="h-full rounded-full bg-foreground/75 transition-[width]"
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}
