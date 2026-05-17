import type { AccessRecord } from "@nile/core/models/access";
import type { EndpointOpenAiProtocol } from "@nile/core/models/endpoint";
import { AgentProjectionError } from "@nile/core/projection/ProjectionError";
import type { AgentProjectionRegistration, ProjectionInput } from "@nile/core/projection/Types";
import { isEnvKeyApiKeyCredential, type StoredCredential } from "@nile/core/services/credential";
import { joinEndpointUrl } from "@nile/core/projection/Url";
import type { CodexProjection } from "./ProjectionTypes";

class CodexProjectionStrategy {
  resolve(input: ProjectionInput): CodexProjection {
    const protocol = input.endpoint.protocols.openai;
    if (!protocol) {
      throw new AgentProjectionError(`Endpoint ${input.endpoint.id} does not support the OpenAI protocol required by codex`);
    }

    this.validateAccess(input.access, input.credential);

    const envKey = input.access.authMode === "api_key"
      ? this.resolveEnvKey(protocol, input.credential)
      : undefined;

    return {
      agentId: "codex",
      protocol: "openai",
      endpointId: input.endpoint.id,
      endpointLabel: input.endpoint.label,
      accessId: input.access.id,
      accessLabel: input.access.label,
      authMode: input.access.authMode as CodexProjection["authMode"],
      authScheme: "bearer",
      baseUrl: joinEndpointUrl(input.endpoint.rootUrl, protocol.basePath),
      wireApi: protocol.wireApis[0] ?? "responses",
      ...(envKey ? { envKey } : {}),
    };
  }

  private resolveEnvKey(
    protocol: EndpointOpenAiProtocol,
    credential: StoredCredential,
  ): string | undefined {
    if (isEnvKeyApiKeyCredential(credential)) {
      return credential.envKey;
    }
    return undefined;
  }

  private validateAccess(access: AccessRecord, credential: StoredCredential): void {
    if (access.authMode !== "api_key" && access.authMode !== "openai_session") {
      throw new AgentProjectionError(`Codex does not support access auth mode ${access.authMode}`);
    }

    if (access.authMode === "api_key" && credential.kind !== "api_key") {
      throw new AgentProjectionError("Codex api_key access requires an api_key credential");
    }

    if (access.authMode === "openai_session" && credential.kind !== "openai_session") {
      throw new AgentProjectionError("Codex openai_session access requires an openai_session credential");
    }
  }
}

const STRATEGY = new CodexProjectionStrategy();

export const CODEX_PROJECTION = {
  agentId: "codex",
  resolve: (input) => STRATEGY.resolve(input),
} as const satisfies AgentProjectionRegistration;
