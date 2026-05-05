import type { AgentId } from "../models/agent/Types";
import type { AgentProjection, ProjectionInput } from "./Types";
import { CodexProjectionStrategy } from "./strategies/Codex";
import { ClaudeProjectionStrategy } from "./strategies/Claude";
import { CursorProjectionStrategy } from "./strategies/Cursor";
import { OpenClawProjectionStrategy } from "./strategies/OpenClaw";
import { AgentProjectionError } from "./ProjectionError";

export class AgentProjectionResolver {
  private readonly codex = new CodexProjectionStrategy();
  private readonly claude = new ClaudeProjectionStrategy();
  private readonly cursor = new CursorProjectionStrategy();
  private readonly openclaw = new OpenClawProjectionStrategy();

  resolve(agentId: AgentId, input: ProjectionInput): AgentProjection {
    switch (agentId) {
      case "codex":
        return this.codex.resolve(input);
      case "claude":
        return this.claude.resolve(input);
      case "cursor":
        return this.cursor.resolve(input);
      case "openclaw":
        return this.openclaw.resolve(input);
      default:
        throw new AgentProjectionError(`No projection strategy is registered for ${agentId}`);
    }
  }
}
