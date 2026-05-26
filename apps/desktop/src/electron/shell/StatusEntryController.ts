import type { AgentId } from "@nile/core/models/agent";

import type { ConnectionQuotaMetricPreferences } from "../../state/ConnectionQuotaMetricPreferences";
import type { DesktopStatusEntryDisplayState } from "../../state/StatusEntryDisplay";
import { DesktopStatusEntrySummary } from "./StatusEntrySummary";
import { DesktopStatusEntryTitle } from "./StatusEntryTitle";
import { readDesktopPlatformCapabilities } from "./PlatformCapabilities";
import type { DesktopStatusEntryState } from "../../state/Types";

type StatusEntryShell = {
  setTrayTitle(title: string): void;
  setTrayToolTip(text: string): void;
};

type StatusEntryControllerOptions = {
  appName: string;
  platform: NodeJS.Platform;
  readConnectionQuotaMetricPreferences(): ConnectionQuotaMetricPreferences;
  readDisplayState(): DesktopStatusEntryDisplayState;
  readStatusEntryState(): DesktopStatusEntryState | null;
  shell: StatusEntryShell;
  writeSelectedAgentIds(agentIds: AgentId[]): DesktopStatusEntryDisplayState;
};

export class DesktopStatusEntryController {
  constructor(private readonly options: StatusEntryControllerOptions) {}

  toggleSelectedAgent(agentId: AgentId): DesktopStatusEntryDisplayState {
    const preferences = this.options.readDisplayState();
    const nextSelectedAgentIds = DesktopStatusEntryTitle.toggleSelectedAgentIds(
      this.options.readStatusEntryState(),
      preferences,
      agentId,
    );
    return this.options.writeSelectedAgentIds(nextSelectedAgentIds);
  }

  sync(): void {
    const connectionQuotaMetricPreferences = this.options.readConnectionQuotaMetricPreferences();
    const state = this.options.readStatusEntryState();
    const preferences = this.options.readDisplayState();
    const platformCapabilities = readDesktopPlatformCapabilities(this.options.platform);

    if (platformCapabilities.supportsTitleTicker) {
      this.options.shell.setTrayTitle(
        DesktopStatusEntryTitle.format(
          state,
          preferences,
          connectionQuotaMetricPreferences,
        ),
      );
    }
    if (platformCapabilities.supportsTraySummary) {
      this.options.shell.setTrayToolTip(
        DesktopStatusEntrySummary.formatTrayTooltip(
          this.options.appName,
          state,
          preferences,
          connectionQuotaMetricPreferences,
        ),
      );
    }
  }
}
