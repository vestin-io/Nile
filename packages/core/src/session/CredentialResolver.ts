import type { AgentHomes } from "../models/agent/Homes";
import type { AgentRuntimeCommandOverrides } from "../models/agent/RuntimeCommands";
import type { EnvironmentSource } from "../services/EnvironmentSource";
import { CurrentSessionResolver } from "./Resolver";
import { INTERACTIVE_SESSION_LOGIN_REGISTRY, type InteractiveSessionLoginRegistry } from "./Login";
import type { CurrentSessionCredentialRequest, CurrentSessionStoredCredential } from "./Types";
import type { InteractiveSessionLoginRequest, InteractiveSessionLoginStoredCredential } from "./LoginTypes";

export type SessionCredentialRequest =
  | CurrentSessionCredentialRequest
  | InteractiveSessionLoginRequest;

export type SessionStoredCredential =
  | CurrentSessionStoredCredential
  | InteractiveSessionLoginStoredCredential;

export class SessionCredentialResolver {
  private readonly currentSessionResolver: CurrentSessionResolver;

  constructor(
    private readonly agentHomes: AgentHomes | undefined,
    private readonly environment: EnvironmentSource,
    private readonly interactiveSessionLoginRegistry: Pick<
      InteractiveSessionLoginRegistry,
      "signInAndRead"
    > = INTERACTIVE_SESSION_LOGIN_REGISTRY,
    private readonly openExternalUrl?: (url: string) => Promise<void>,
    private readonly agentRuntimeCommandOverrides?: AgentRuntimeCommandOverrides,
  ) {
    this.currentSessionResolver = new CurrentSessionResolver(agentHomes, environment);
  }

  resolve(request: SessionCredentialRequest): SessionStoredCredential {
    if (request.source === "login") {
      throw new Error(`${request.authMode} login requires async resolution`);
    }
    return this.currentSessionResolver.resolve(request);
  }

  async resolveAsync(request: SessionCredentialRequest): Promise<SessionStoredCredential> {
    if (request.source !== "login") {
      return this.resolve(request);
    }

    return await this.interactiveSessionLoginRegistry.signInAndRead(
      {
        agentHomes: this.agentHomes,
        agentRuntimeCommandOverrides: this.agentRuntimeCommandOverrides,
        environment: this.environment,
        openExternalUrl: this.openExternalUrl,
      },
      request,
    );
  }
}
