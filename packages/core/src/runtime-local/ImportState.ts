import type { StoredCredential } from "../services/credential/Types";
import type { AgentId } from "../models/agent/Definitions";
import type { AgentConnectionSettingRecord } from "../models/agent-settings/Types";
import type { EndpointProtocols } from "../models/endpoint/Types";
import type { AgentSelectionRecord } from "../models/selection/Types";

export type MatchedImportStateSnapshot = {
  agentId: AgentId;
  connectionId: string;
  endpointId: string;
  endpointProtocols: EndpointProtocols;
  identityKey: string | null;
  credential: StoredCredential;
  selection: AgentSelectionRecord | null;
  modelSetting: AgentConnectionSettingRecord | null;
};
