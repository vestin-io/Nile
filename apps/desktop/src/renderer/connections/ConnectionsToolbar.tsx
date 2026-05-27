import { Download, Plus, Search, Upload } from "lucide-react";

import type { Translator } from "../shared/I18n";
import type { DesktopConnection } from "../../state/Types";
import { readEndpointProviderIconNode, readProviderLabel } from "./ProviderDisplay";
import { RefreshButton } from "../shared/RefreshButton";
import { Button } from "../ui/button";
import { type ComboboxItem, Combobox } from "../ui/combobox";
import { Input } from "../ui/input";

type ConnectionsToolbarProps = {
  isPortabilityBusy?: boolean;
  selectedConnectionCount?: number;
  t: Translator;
  showAddButton?: boolean;
  showPortabilityActions?: boolean;
  showSearchAndFilter?: boolean;
  providerFilter?: DesktopConnection["endpointFamily"] | "all";
  providers?: DesktopConnection["endpointFamily"][];
  searchQuery?: string;
  onProviderFilterChange?(value: DesktopConnection["endpointFamily"] | "all"): void;
  onExportSelected?(): Promise<void>;
  onImport?(): Promise<void>;
  onOpenAddPage(): void;
  onRefresh(): Promise<void>;
  onSearchQueryChange?(value: string): void;
};

export function ConnectionsToolbar({
  isPortabilityBusy = false,
  selectedConnectionCount = 0,
  t,
  showAddButton = true,
  showPortabilityActions = false,
  showSearchAndFilter = true,
  providerFilter = "all",
  providers = [],
  searchQuery = "",
  onProviderFilterChange,
  onExportSelected,
  onImport,
  onOpenAddPage,
  onRefresh,
  onSearchQueryChange,
}: ConnectionsToolbarProps) {
  const providerItems: ComboboxItem<DesktopConnection["endpointFamily"] | "all">[] = [
    {
      value: "all",
      label: t("connections.filterProviderAll"),
    },
    ...providers.map((provider) => ({
      value: provider,
      label: readProviderLabel(provider, t),
      icon: readEndpointProviderIconNode(provider),
    })),
  ];

  return (
    <div className="flex items-center gap-2">
      {showSearchAndFilter ? (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 rounded-xl pl-9"
              placeholder={t("connections.searchPlaceholder")}
              value={searchQuery}
              onChange={(event) => onSearchQueryChange?.(event.target.value)}
            />
          </div>
          <div className="w-[13rem] shrink-0">
            <Combobox
              items={providerItems}
              value={providerFilter}
              placeholder={t("common.provider")}
              searchPlaceholder={t("addConnection.searchPresetPlaceholder")}
              emptyLabel={t("addConnection.noPresetResults")}
              onValueChange={(value) => onProviderFilterChange?.(value)}
            />
          </div>
        </div>
      ) : <div className="flex-1" />}
      <div className="flex shrink-0 items-center">
        <div className="flex overflow-hidden rounded-xl border bg-background">
          {showPortabilityActions ? (
            <>
              <Button
                variant="ghost"
                className="h-11 rounded-none border-r px-4 lg:px-5"
                disabled={!onImport || isPortabilityBusy}
                aria-label={t("settings.credentialPortability.importAction")}
                title={t("settings.credentialPortability.importAction")}
                onClick={() => {
                  void onImport?.();
                }}
              >
                <Download className="h-4 w-4" />
                <span className="hidden lg:inline">{t("settings.credentialPortability.importAction")}</span>
              </Button>
              <Button
                variant="ghost"
                className="h-11 rounded-none border-r px-4 lg:px-5"
                disabled={!onExportSelected || isPortabilityBusy}
                aria-label={t("settings.credentialPortability.exportAction")}
                title={t("settings.credentialPortability.exportAction")}
                onClick={() => {
                  void onExportSelected?.();
                }}
              >
                <Upload className="h-4 w-4" />
                <span className="hidden lg:inline">
                  {selectedConnectionCount > 0
                    ? `${t("settings.credentialPortability.exportAction")} (${selectedConnectionCount})`
                    : t("settings.credentialPortability.exportAction")}
                </span>
              </Button>
            </>
          ) : null}
          {showAddButton ? (
            <Button
              variant="ghost"
              className="h-11 rounded-none border-r px-4 lg:px-5"
              aria-label={t("common.addConnection")}
              title={t("common.addConnection")}
              onClick={onOpenAddPage}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden lg:inline">{t("common.addConnection")}</span>
            </Button>
          ) : null}
          <RefreshButton
            className="h-11 rounded-none border-0 px-4 shadow-none"
            iconOnly
            label={t("common.refresh")}
            size="default"
            variant="ghost"
            onRefresh={onRefresh}
          />
        </div>
      </div>
    </div>
  );
}
