import type { AgentId } from "../models/agent/Definitions";
import type { AgentProjection, ProjectionInput } from "./Types";
import { AGENT_PROJECTION_REGISTRY } from "./Registry";
import { AgentProjectionError } from "./ProjectionError";

export class AgentProjectionResolver {
  resolve(agentId: AgentId, input: ProjectionInput): AgentProjection {
    return AGENT_PROJECTION_REGISTRY.read(agentId).resolve(input);
  }
}
