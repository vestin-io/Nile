import type { ReactNode } from "react";

import { Button } from "../ui/button";
import { cn } from "../ui/cn";

export type DetailActionItem = {
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onClick(): void;
};

type DetailActionGroupProps = {
  items: DetailActionItem[];
};

export function DetailActionGroup({ items }: DetailActionGroupProps) {
  return (
    <div className="inline-flex overflow-hidden rounded-xl border bg-background shadow-sm">
      {items.map((item) => (
        <ActionButton
          key={item.label}
          danger={item.danger}
          disabled={item.disabled}
          icon={item.icon}
          label={item.label}
          onClick={item.onClick}
        />
      ))}
    </div>
  );
}

function ActionButton({
  danger = false,
  disabled = false,
  icon,
  label,
  onClick,
}: {
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onClick(): void;
}) {
  return (
    <Button
      aria-label={label}
      className={cn(
        "min-w-10 rounded-none border-l px-3 shadow-none first:border-l-0 md:px-4",
        danger
          ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
          : undefined,
      )}
      disabled={disabled}
      title={label}
      variant="ghost"
      onClick={onClick}
    >
      {icon ? <span className="md:hidden">{icon}</span> : null}
      <span className={icon ? "hidden md:inline" : "inline"}>{label}</span>
    </Button>
  );
}
