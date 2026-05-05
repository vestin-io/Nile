import { ArrowUpDown, Check } from "lucide-react";

import type { Translator } from "../../shared/I18n";
import { RefreshButton } from "../../shared/RefreshButton";
import { Button } from "../../ui/button";

type AgentListToolbarProps = {
  isEditingOrder: boolean;
  showQuickSetupEntry: boolean;
  t: Translator;
  onOpenQuickSetup(): void;
  onRefresh(): Promise<void>;
  onToggleEdit(): void;
};

export function AgentListToolbar({
  isEditingOrder,
  showQuickSetupEntry,
  t,
  onOpenQuickSetup,
  onRefresh,
  onToggleEdit,
}: AgentListToolbarProps) {
  return (
    <div className="flex justify-end gap-2">
      {showQuickSetupEntry ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenQuickSetup}
        >
          {t("nav.quickSetup")}
        </Button>
      ) : null}
      <Button
        aria-label={isEditingOrder ? t("common.done") : t("common.editOrder")}
        className="h-9 w-9 p-0"
        size="sm"
        title={isEditingOrder ? t("common.done") : t("common.editOrder")}
        variant="outline"
        onClick={onToggleEdit}
      >
        {isEditingOrder ? <Check className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4" />}
      </Button>
      <RefreshButton
        className="h-9 w-9 p-0"
        iconOnly
        label={t("common.refresh")}
        size="sm"
        variant="outline"
        onRefresh={onRefresh}
      />
    </div>
  );
}
