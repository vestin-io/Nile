import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

type ChoiceCardProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  description?: ReactNode;
  selected?: boolean;
  title: ReactNode;
};

export function ChoiceCard({
  className,
  description,
  selected = false,
  title,
  ...props
}: ChoiceCardProps) {
  return (
    <button
      className={cn(
        "rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-foreground bg-accent/50 shadow-sm"
          : "border-border bg-background hover:border-foreground/30 hover:bg-accent/30",
        className,
      )}
      type="button"
      {...props}
    >
      <div className="font-medium">{title}</div>
      {description ? (
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      ) : null}
    </button>
  );
}
