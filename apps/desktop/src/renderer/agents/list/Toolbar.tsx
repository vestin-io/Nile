import { ArrowUpDown, Check, Waves } from "lucide-react";

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
    <div className="flex justify-end">
      <div className="flex overflow-hidden rounded-xl border bg-background">
        {showQuickSetupEntry ? (
          <Button
            aria-label={t("nav.quickSetup")}
            className="h-9 rounded-none border-r px-3"
            size="sm"
            title={t("nav.quickSetup")}
            variant="ghost"
            onClick={onOpenQuickSetup}
          >
            <Waves className="h-4 w-4" />
            <span className="hidden lg:inline">{t("nav.quickSetup")}</span>
          </Button>
        ) : null}
        <Button
          aria-label={isEditingOrder ? t("common.done") : t("common.editOrder")}
          className="h-9 rounded-none border-r px-3"
          size="sm"
          title={isEditingOrder ? t("common.done") : t("common.editOrder")}
          variant="ghost"
          onClick={onToggleEdit}
        >
          {isEditingOrder ? <Check className="h-4 w-4" /> : <ArrowUpDown className="h-4 w-4" />}
        </Button>
        <RefreshButton
          className="h-9 rounded-none border-0 px-3 shadow-none"
          iconOnly
          label={t("common.refresh")}
          size="sm"
          variant="ghost"
          onRefresh={onRefresh}
        />
      </div>
    </div>
  );
}
