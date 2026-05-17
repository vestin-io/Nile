import { Plus, Search } from "lucide-react";

import type { Translator } from "../shared/I18n";
import type { DesktopConnection } from "../../state/Types";
import { readEndpointProviderIconNode, readProviderLabel } from "./ProviderDisplay";
import { RefreshButton } from "../shared/RefreshButton";
import { Button } from "../ui/button";
import { type ComboboxItem, Combobox } from "../ui/combobox";
import { Input } from "../ui/input";

type ConnectionsToolbarProps = {
  t: Translator;
  showAddButton?: boolean;
  showSearchAndFilter?: boolean;
  providerFilter?: DesktopConnection["endpointFamily"] | "all";
  providers?: DesktopConnection["endpointFamily"][];
  searchQuery?: string;
  onProviderFilterChange?(value: DesktopConnection["endpointFamily"] | "all"): void;
  onOpenAddPage(): void;
  onRefresh(): Promise<void>;
  onSearchQueryChange?(value: string): void;
};

export function ConnectionsToolbar({
  t,
  showAddButton = true,
  showSearchAndFilter = true,
  providerFilter = "all",
  providers = [],
  searchQuery = "",
  onProviderFilterChange,
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
      <div className="flex shrink-0 items-center gap-2">
        {showAddButton ? (
          <Button className="h-11 rounded-xl px-5" onClick={onOpenAddPage}>
            <Plus className="h-4 w-4" />
            {t("common.addConnection")}
          </Button>
        ) : null}
        <RefreshButton
          className="h-11 w-11 rounded-xl p-0"
          iconOnly
          label={t("common.refresh")}
          size="default"
          variant="outline"
          onRefresh={onRefresh}
        />
      </div>
    </div>
  );
}
