import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { Translator } from "../../shared/I18n";
import { cn } from "../../ui/cn";
import { Button } from "../../ui/button";

type ConnectionActionGroupProps = {
  canRemove: boolean;
  t: Translator;
  onEdit(): void;
  onRefresh(): Promise<void>;
  onRemove(): Promise<void>;
};

export function ConnectionActionGroup({
  canRemove,
  t,
  onEdit,
  onRefresh,
  onRemove,
}: ConnectionActionGroupProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  return (
    <div className="inline-flex overflow-hidden rounded-xl border bg-background shadow-sm">
      <ActionButton
        icon={<Pencil className="h-4 w-4" />}
        label={t("common.edit")}
        onClick={onEdit}
      />
      <ActionButton
        disabled={isRefreshing}
        icon={<RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />}
        label={t("common.refresh")}
        onClick={() => {
          if (isRefreshing) {
            return;
          }
          setIsRefreshing(true);
          void onRefresh().finally(() => {
            setIsRefreshing(false);
          });
        }}
      />
      {canRemove ? (
        <ActionButton
          danger
          icon={<Trash2 className="h-4 w-4" />}
          label={t("common.remove")}
          onClick={() => {
            void onRemove();
          }}
        />
      ) : null}
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
  icon: ReactNode;
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
      <span className="md:hidden">{icon}</span>
      <span className="hidden md:inline">{label}</span>
    </Button>
  );
}
