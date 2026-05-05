import type { ButtonHTMLAttributes } from "react";

import { cn } from "./cn";
import { Button } from "./button";

type TextButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "muted";
  underline?: boolean;
};

export function TextButton({
  className,
  tone = "default",
  underline = false,
  ...props
}: TextButtonProps) {
  return (
    <Button
      className={cn(
        "h-auto px-0 py-0 hover:bg-transparent",
        tone === "default"
          ? "justify-start text-left font-medium hover:text-foreground/80"
          : "text-muted-foreground hover:text-foreground",
        underline && "underline-offset-4 hover:underline",
        className,
      )}
      size="sm"
      variant="ghost"
      {...props}
    />
  );
}
