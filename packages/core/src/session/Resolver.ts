import type { AgentHomes } from "../models/agent/Homes";
import type { EnvironmentSource } from "../services/EnvironmentSource";
import { CURRENT_SESSION_SOURCE_REGISTRY } from "./Registry";
import type {
  CurrentSessionCredentialRequest,
  CurrentSessionStoredCredential,
} from "./Types";

export class CurrentSessionResolver {
  constructor(
    private readonly agentHomes: AgentHomes | undefined,
    private readonly environment: EnvironmentSource,
  ) {}

  resolve(request: CurrentSessionCredentialRequest): CurrentSessionStoredCredential {
    return CURRENT_SESSION_SOURCE_REGISTRY.resolve({
      agentHomes: this.agentHomes,
      environment: this.environment,
    }, request);
  }
}
