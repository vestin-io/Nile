import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

import type { Translator } from "../../shared/I18n";
import { DetailActionGroup } from "../../shared/DetailActionGroup";
import { cn } from "../../ui/cn";

type ConnectionActionGroupProps = {
  canRemove: boolean;
  canEdit?: boolean;
  canRefresh?: boolean;
  t: Translator;
  onEdit(): void;
  onRefresh(): Promise<void>;
  onRemove(): Promise<void>;
};

export function ConnectionActionGroup({
  canRemove,
  canEdit = true,
  canRefresh = true,
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
          disabled: !canEdit,
          icon: <Pencil className="h-4 w-4" />,
          label: t("common.edit"),
          onClick: () => {
            if (!canEdit) {
              return;
            }
            onEdit();
          },
        },
        {
          disabled: !canRefresh || isRefreshing,
          icon: <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />,
          label: t("common.refresh"),
          onClick: () => {
            if (!canRefresh || isRefreshing) {
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
