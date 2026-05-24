import type { AgentId } from "../../models/agent/Definitions";
import type { CredentialStorageBackend } from "../../services/credential/Store";

export type ScanItemState =
  | "new"
  | "already_saved"
  | "invalid"
  | "unavailable";

export type ScanItem = {
  scanId: AgentId;
  agentId: AgentId;
  sourceKind: "current_live_setup";
  title: string;
  subtitle: string;
  state: ScanItemState;
  importable: boolean;
  defaultSelected: boolean;
  issues: string[];
};

export type ScanLocalSetupsResult = {
  items: ScanItem[];
  importableCount: number;
};

export type ImportDetectedSetupsInput = {
  selections: Array<{ scanId: AgentId }>;
  credentialStorageBackend?: CredentialStorageBackend;
};

export type ImportDetectedSetupResult = {
  scanId: AgentId;
  status: "created" | "reused" | "skipped" | "failed";
  connectionId?: string;
  connectionLabel?: string;
  message?: string;
};

export type ImportDetectedSetupsResult = {
  results: ImportDetectedSetupResult[];
};
