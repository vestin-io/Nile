import type { AgentId } from "../models/agent/Types";
import type { AgentProjectionStrategy, AgentProjection, ProjectionInput } from "./Types";
import { CodexProjectionStrategy } from "./strategies/Codex";
import { ClaudeProjectionStrategy } from "./strategies/Claude";
import { CursorProjectionStrategy } from "./strategies/Cursor";
import { OpenClawProjectionStrategy } from "./strategies/OpenClaw";
import { AgentProjectionError } from "./ProjectionError";

const DEFAULT_STRATEGIES: AgentProjectionStrategy[] = [
  new CodexProjectionStrategy(),
  new ClaudeProjectionStrategy(),
  new CursorProjectionStrategy(),
  new OpenClawProjectionStrategy(),
];

export class AgentProjectionResolver {
  constructor(private readonly strategies: AgentProjectionStrategy[] = DEFAULT_STRATEGIES) {}

  resolve(agentId: AgentId, input: ProjectionInput): AgentProjection {
    const strategy = this.strategies.find((candidate) => candidate.agentId === agentId);
    if (!strategy) {
      throw new AgentProjectionError(`No projection strategy is registered for ${agentId}`);
    }

    return strategy.resolve(input);
  }
}
