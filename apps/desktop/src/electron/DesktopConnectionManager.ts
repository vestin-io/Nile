import {
  type LocalCredentialRequest,
  LocalCredentialRequestBuilder,
} from "@nile/core/application/local";
import type { ConnectionDefinition, ConnectionPresetFamily, CreateConnectionResult } from "@nile/core/models/connection";
import type { SavedConnectionSummary } from "@nile/core/models/connection";
import { SHARED_CONNECTION_CATALOG } from "@nile/core/models/connection";
import { ConnectionLabeler } from "@nile/core/models/connection";
import {
  NileSession,
  type BindCursorUsageResult,
  type CursorUsageAutoBindResult,
  type ConnectionOnboardingSuggestion,
  type ImportCurrentConnectionResult,
  type RemoveConnectionResult,
} from "@nile/core/runtime-local";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import {
  isEnvKeyApiKeyCredential,
  type StoredCredential,
  type CredentialStore,
} from "@nile/core/services/credential";
import { isAgentId, type AgentHomes } from "@nile/core/models/agent";
import type { AgentId } from "@nile/core/models/agent";
import { ClaudeSessionLogin, CodexSessionLogin } from "@nile/core/agents";
import { LocalCredentialResolver } from "@nile/core/application/local";
import { CursorUsageSessionSourceProbe } from "@nile/host-local";
import { randomUUID } from "node:crypto";

import {
  type DesktopAddConnectionInput,
  type DesktopDiscardPreparedConnectionDraftInput,
  type DesktopDescribeSavedConnectionOnboardingInput,
  type DesktopConnectionSummary,
  type DesktopPreparedConnectionDraft,
  type DesktopSavePreparedConnectionInput,
  type DesktopUpdateConnectionInput,
} from "./types";
import { SessionRunner } from "./SessionRunner";

type DesktopConnectionManagerOptions = {
  databasePath: string;
  agentHomes?: AgentHomes;
  environment: EnvironmentSource;
  credentialStore: CredentialStore;
};

export class DesktopConnectionManager {
  private readonly localCredentialResolver: LocalCredentialResolver;
  private readonly cursorUsageSessionProbe = CursorUsageSessionSourceProbe.createDefault();
  private readonly sessions: SessionRunner;
  private readonly labeler = new ConnectionLabeler();
  private readonly requestBuilder = new LocalCredentialRequestBuilder();
  private readonly preparedDrafts = new Map<string, PreparedConnectionDraftRecord>();

  constructor(
    private readonly options: DesktopConnectionManagerOptions,
    loginRunner: CodexSessionLogin = new CodexSessionLogin(options.environment),
    claudeLoginRunner: ClaudeSessionLogin = new ClaudeSessionLogin(options.environment),
  ) {
    this.localCredentialResolver = new LocalCredentialResolver(
      this.options.agentHomes,
      this.options.environment,
      loginRunner,
      claudeLoginRunner,
    );
    this.sessions = new SessionRunner(this);
  }

  listDefinitions(): ConnectionDefinition[] {
    return SHARED_CONNECTION_CATALOG.listDefinitions();
  }

  async addConnection(input: DesktopAddConnectionInput): Promise<DesktopConnectionSummary> {
    return await this.sessions.runAsync(async (session) => {
      const created = await session.createLocalConnectionWithLocalEffects(
        this.buildLocalConnectionInput(input),
        this.localCredentialResolver,
      );
      return this.buildConnectionSummary(created);
    });
  }

  async updateConnection(input: DesktopUpdateConnectionInput): Promise<DesktopConnectionSummary> {
    return await this.sessions.runAsync(async (session) => {
      const existing = session.listSavedConnections().find((connection) => connection.id === input.connectionId);
      if (!existing) {
        throw new Error(`Connection not found: ${input.connectionId}`);
      }
      const updated = await session.updateConnection({
        connectionId: input.connectionId,
        label: input.label?.trim() || undefined,
        enabledAgents: input.enabledAgents,
        endpointUrl: input.endpointUrl?.trim() || undefined,
        credentialRequest: this.resolveUpdateCredentialRequest(input, existing.authMode),
      });
      if (input.syncSelectedAgents) {
        for (const selectedAgentId of updated.selectedByAgents) {
          if (!isAgentId(selectedAgentId)) {
            continue;
          }
          session.useConnection(selectedAgentId, updated.id);
        }
      }
      return this.buildConnectionSummary(updated);
    });
  }

  async describeConnectionOnboarding(input: DesktopAddConnectionInput) {
    return await this.sessions.runAsync(async (session) =>
      await session.describeLocalConnectionOnboarding(
        this.buildLocalConnectionInput(input),
        this.localCredentialResolver,
      ),
    );
  }

  async describeSavedConnectionOnboarding(input: DesktopDescribeSavedConnectionOnboardingInput) {
    return await this.sessions.runAsync(async (session) => {
      const existing = session.listSavedConnections().find((connection) => connection.id === input.connectionId);
      if (!existing) {
        throw new Error(`Connection not found: ${input.connectionId}`);
      }

      const preset = this.resolvePresetForSavedConnection(existing);
      const credentialRequest = this.resolveUpdateCredentialRequest(
        {
          connectionId: input.connectionId,
          endpointUrl: input.endpointUrl,
          apiKeySource: input.apiKeySource,
          apiKey: input.apiKey,
          envKey: input.envKey,
        },
        existing.authMode,
      );
      const credential = credentialRequest
        ? this.localCredentialResolver.resolve(credentialRequest)
        : session.readConnectionCredential(input.connectionId);

      return await session.describeConnectionOnboarding({
        preset,
        authMode: existing.authMode,
        credential,
        probeCredential: this.resolveProbeCredential(credentialRequest, credential, this.localCredentialResolver),
        endpointUrl: input.endpointUrl?.trim() || existing.endpointUrl || undefined,
      });
    });
  }

  async prepareConnectionDraft(input: DesktopAddConnectionInput): Promise<DesktopPreparedConnectionDraft> {
    return await this.sessions.runAsync(async (session) => {
      const credential = this.localCredentialResolver.resolve(this.resolveCredentialRequest(input));
      const onboarding = await session.describeConnectionOnboarding({
        preset: input.preset,
        authMode: input.authMode,
        credential,
        endpointUrl: input.endpointUrl,
        label: input.label?.trim() || undefined,
        allowUndetectedGateway: input.allowUndetectedGateway,
      });
      const id = randomUUID();
      const labelSuggestion = this.labeler.suggestAccessLabel(input.preset, input.authMode, credential, {
        endpointUrl: input.endpointUrl,
      });
      this.preparedDrafts.set(id, {
        authMode: input.authMode,
        credential,
        endpointUrl: input.endpointUrl,
        onboarding,
        preset: input.preset,
      });
      return {
        id,
        authMode: input.authMode,
        labelSuggestion,
        configurableAgents: onboarding.configurableAgents,
        defaultEnabledAgents: onboarding.defaultEnabledAgents,
        suggestedAgents: onboarding.suggestedAgents,
      };
    });
  }

  importCurrentConnection(agentId: AgentId): DesktopConnectionSummary {
    return this.sessions.run((session) => {
      const imported = session.importCurrentConnectionWithLocalEffects(agentId);
      return this.buildConnectionSummary(imported);
    });
  }

  removeConnection(connectionId: string): RemoveConnectionResult {
    return this.sessions.run((session) => session.removeConnection(connectionId));
  }

  bindCursorUsage(connectionId: string, sessionToken: string): BindCursorUsageResult {
    return this.sessions.run((session) => session.bindCursorUsage(connectionId, sessionToken));
  }

  autoBindCursorUsage(connectionId: string): CursorUsageAutoBindResult {
    return this.sessions.run((session) => session.autoBindCursorUsage(connectionId));
  }

  autoBindAllCursorUsage(): CursorUsageAutoBindResult[] {
    return this.sessions.run((session) => session.autoBindAllCursorUsage());
  }

  async savePreparedConnection(input: DesktopSavePreparedConnectionInput): Promise<DesktopConnectionSummary> {
    const draft = this.preparedDrafts.get(input.draftId);
    if (!draft) {
      throw new Error("Prepared connection draft not found");
    }

    try {
      return await this.sessions.runAsync(async (session) => {
        const created = await session.createConnectionWithLocalEffects({
          preset: draft.preset,
          authMode: draft.authMode,
          credential: draft.credential,
          endpointUrl: draft.endpointUrl,
          label: input.label?.trim() || undefined,
          enabledAgents: input.enabledAgents ?? draft.onboarding.defaultEnabledAgents,
        });
        return this.buildConnectionSummary(created);
      });
    } finally {
      this.preparedDrafts.delete(input.draftId);
    }
  }

  discardPreparedConnectionDraft(input: DesktopDiscardPreparedConnectionDraftInput): void {
    this.preparedDrafts.delete(input.draftId);
  }

  private resolveCredentialRequest(input: DesktopAddConnectionInput): LocalCredentialRequest {
    return this.requestBuilder.build({
      authMode: input.authMode,
      apiKeySource: input.apiKeySource,
      apiKey: input.apiKey,
      envKey: input.envKey,
      openAiSessionSource: input.openAiSessionSource,
      openAiAuthJsonPath: input.openAiAuthJsonPath,
      claudeSessionSource: input.claudeSessionSource,
    });
  }

  private buildLocalConnectionInput(input: DesktopAddConnectionInput) {
    return {
      preset: input.preset,
      authMode: input.authMode,
      credentialRequest: this.resolveCredentialRequest(input),
      endpointUrl: input.endpointUrl,
      label: input.label,
      enabledAgents: input.enabledAgents,
      allowUndetectedGateway: input.allowUndetectedGateway,
    };
  }

  private resolvePresetForSavedConnection(connection: SavedConnectionSummary): ConnectionPresetFamily {
    if (!connection.endpointFamily || connection.endpointFamily === "cursor") {
      throw new Error(`Connection ${connection.id} does not support capability detection`);
    }
    return connection.endpointFamily;
  }

  private resolveUpdateCredentialRequest(
    input: DesktopUpdateConnectionInput,
    authMode: SavedConnectionSummary["authMode"],
  ): LocalCredentialRequest | undefined {
    return this.requestBuilder.buildUpdate(authMode, {
      apiKeySource: input.apiKeySource,
      apiKey: input.apiKey,
      envKey: input.envKey,
      openAiSessionSource: input.openAiSessionSource,
      openAiAuthJsonPath: input.openAiAuthJsonPath,
      claudeSessionSource: input.claudeSessionSource,
    });
  }

  private resolveProbeCredential(
    request: LocalCredentialRequest | undefined,
    credential: StoredCredential,
    localCredentialResolver: LocalCredentialResolver,
  ): StoredCredential {
    if (request?.authMode === "api_key" && request.source === "env_key") {
      return localCredentialResolver.resolveProbeCredential(request);
    }

    if (isEnvKeyApiKeyCredential(credential)) {
      return localCredentialResolver.resolveProbeCredential({
        authMode: "api_key",
        source: "env_key",
        envKey: credential.envKey,
      });
    }

    return credential;
  }

  private buildConnectionSummary(
    result: CreateConnectionResult | ImportCurrentConnectionResult | SavedConnectionSummary,
  ): DesktopConnectionSummary {
    const endpointFamily = result.endpointFamily ?? "unknown";
    return {
      id: result.id,
      label: result.label,
      endpointId: result.endpointId,
      endpointUrl: "endpointUrl" in result ? result.endpointUrl : undefined,
      endpointLabel: result.endpointLabel,
      endpointFamily,
      authMode: result.authMode,
      apiKeySource: "apiKeySource" in result ? result.apiKeySource : undefined,
      envKey: "envKey" in result ? result.envKey : undefined,
      ...("reused" in result && result.reused ? { reused: true } : {}),
    };
  }

  openSession(): NileSession {
    return NileSession.open({
      databasePath: this.options.databasePath,
      agentHomes: this.options.agentHomes,
      environment: this.options.environment,
      credentialStore: this.options.credentialStore,
      cursorUsageSessionProbe: this.cursorUsageSessionProbe,
    });
  }
}

type PreparedConnectionDraftRecord = {
  authMode: DesktopAddConnectionInput["authMode"];
  credential: StoredCredential;
  endpointUrl?: string;
  onboarding: ConnectionOnboardingSuggestion;
  preset: DesktopAddConnectionInput["preset"];
};
