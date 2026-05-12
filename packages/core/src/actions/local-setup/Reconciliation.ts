import type { AgentDetectionResult } from "../../models/agent";

export type AgentSetupReconciliationState =
  | "already_saved"
  | "new"
  | "invalid"
  | "unverified"
  | "unavailable";

export type AgentSetupReconciliation = {
  state: AgentSetupReconciliationState;
  hasLiveSetup: boolean;
};

export class AgentSetupReconciliationReader {
  read(detection: AgentDetectionResult): AgentSetupReconciliation {
    const hasLiveSetup = Boolean(
      detection.detectedState.endpoint || detection.detectedState.access || detection.detectedState.matchedConnection,
    );
    const validity = detection.detectedState.validity;
    if (validity === "valid_matched") {
      return { state: "already_saved", hasLiveSetup };
    }
    if (validity === "valid_import_candidate") {
      return { state: "new", hasLiveSetup };
    }
    if (validity === "valid_unverified") {
      return { state: "unverified", hasLiveSetup };
    }
    if (!hasLiveSetup && detection.detectedState.issues.length === 0) {
      return { state: "unavailable", hasLiveSetup: false };
    }
    return { state: "invalid", hasLiveSetup };
  }
}

export const AGENT_SETUP_RECONCILIATION = new AgentSetupReconciliationReader();
