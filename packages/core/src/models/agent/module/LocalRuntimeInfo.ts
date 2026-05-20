import type { EnvironmentSource } from "../../../services/EnvironmentSource";

export type AgentLocalRuntimeInfo = {
  runtimeCommandPath: string | null;
};

export type AgentLocalRuntimeInfoContext = {
  runtimeCommandPathOverride?: string | null;
  environment: EnvironmentSource;
};

export interface AgentLocalRuntimeInfoProvider {
  read(context: AgentLocalRuntimeInfoContext): AgentLocalRuntimeInfo;
}
