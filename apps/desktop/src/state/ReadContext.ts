import type { AgentStatusView } from "@nile/core/actions/local-setup";
import type { SavedConnectionSummary } from "@nile/core/models/connection";

import type { DesktopOnboardingState } from "./Types";

export type DesktopStateReadContext = {
  savedConnections: SavedConnectionSummary[];
  scan: DesktopOnboardingState;
  statuses: AgentStatusView[];
};
