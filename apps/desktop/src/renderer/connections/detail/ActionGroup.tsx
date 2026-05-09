import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

import type { Translator } from "../../shared/I18n";
import { DetailActionGroup } from "../../shared/DetailActionGroup";
import { cn } from "../../ui/cn";

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
    <DetailActionGroup
      items={[
        {
          icon: <Pencil className="h-4 w-4" />,
          label: t("common.edit"),
          onClick: () => {
            onEdit();
          },
        },
        {
          disabled: isRefreshing,
          icon: <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />,
          label: t("common.refresh"),
          onClick: () => {
            if (isRefreshing) {
              return;
            }
            setIsRefreshing(true);
            void onRefresh().finally(() => {
              setIsRefreshing(false);
            });
          },
        },
        ...(canRemove
            ? [{
              danger: true,
              icon: <Trash2 className="h-4 w-4" />,
              label: t("common.remove"),
              onClick: () => {
                void onRemove();
              },
            }]
          : []),
      ]}
    />
  );
}
