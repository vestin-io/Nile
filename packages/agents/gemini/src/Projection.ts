import type { AccessRecord } from "@nile/core/models/access";
import { AgentProjectionError } from "@nile/core/projection/ProjectionError";
import type {
  AgentProjectionRegistration,
  ProjectionInput,
} from "@nile/core/projection/Types";
import type { StoredCredential } from "@nile/core/services/credential";
import type { GeminiProjection } from "./ProjectionTypes";

class GeminiProjectionStrategy {
  resolve(input: ProjectionInput): GeminiProjection {
    if (!input.endpoint.protocols.gemini) {
      throw new AgentProjectionError(`Endpoint ${input.endpoint.id} does not support the Gemini protocol required by gemini`);
    }

    this.validateAccess(input.access, input.credential);

    return {
      agentId: "gemini",
      protocol: "gemini",
      endpointId: input.endpoint.id,
      endpointLabel: input.endpoint.label,
      accessId: input.access.id,
      accessLabel: input.access.label,
      authMode: "gemini_cli_session",
      selectedAuthType: "oauth-personal",
    };
  }

  private validateAccess(access: AccessRecord, credential: StoredCredential): void {
    if (access.authMode !== "gemini_cli_session") {
      throw new AgentProjectionError(`Gemini does not support access auth mode ${access.authMode}`);
    }
    if (credential.kind !== "gemini_cli_session") {
      throw new AgentProjectionError("Gemini gemini_cli_session access requires a gemini_cli_session credential");
    }
  }
}

const STRATEGY = new GeminiProjectionStrategy();

export const GEMINI_PROJECTION = {
  agentId: "gemini",
  resolve: (input) => STRATEGY.resolve(input),
} as const satisfies AgentProjectionRegistration;
