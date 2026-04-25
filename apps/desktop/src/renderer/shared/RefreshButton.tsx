import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "../ui/button";

type RefreshButtonProps = {
  className?: string;
  iconOnly?: boolean;
  label: string;
  onRefresh(): Promise<void>;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
};

export function RefreshButton({
  className,
  iconOnly = false,
  label,
  onRefresh,
  size = "sm",
  variant = "outline",
}: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  return (
    <Button
      aria-busy={isRefreshing}
      aria-label={label}
      className={className}
      disabled={isRefreshing}
      size={size}
      title={label}
      variant={variant}
      onClick={() => {
        if (isRefreshing) {
          return;
        }

        setIsRefreshing(true);
        void onRefresh().finally(() => {
          setIsRefreshing(false);
        });
      }}
    >
      <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
      {iconOnly ? null : label}
    </Button>
  );
}
