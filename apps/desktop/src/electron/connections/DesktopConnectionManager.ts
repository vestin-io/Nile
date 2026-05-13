import {
  type LocalCredentialRequest,
  type ConnectionModelCatalogResult,
  LocalCredentialRequestBuilder,
} from "@nile/core/application/local";
import type { ConnectionPresetFamily, CreateConnectionResult } from "@nile/core/models/connection";
import type { SavedConnectionSummary } from "@nile/core/models/connection";
import { ConnectionLabeler } from "@nile/core/models/connection";
import {
  NileSession,
} from "@nile/core/runtime-local";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import {
  isEnvKeyApiKeyCredential,
  type StoredCredential,
  type CredentialStore,
} from "@nile/core/services/credential";
import { isAgentId, type AgentHomes } from "@nile/core/models/agent";
import { ClaudeSessionLogin, CodexSessionLogin } from "@nile/core/agents";
import { LocalCredentialResolver } from "@nile/core/application/local";
import { CursorUsageSessionSourceProbe } from "@nile/host-local";

import {
  type DesktopAddConnectionInput,
  type DesktopDiscardPreparedConnectionDraftInput,
  type DesktopDescribeSavedConnectionOnboardingInput,
  type DesktopGetConnectionModelCatalogInput,
  type DesktopConnectionSummary,
  type DesktopPreparedConnectionDraft,
  type DesktopSavePreparedConnectionInput,
  type DesktopUpdateConnectionInput,
} from "./contracts";
import { DesktopConnectionModelCatalog } from "./ModelCatalog";
import { DesktopPreparedDraftStore } from "./DesktopPreparedDraftStore";
import { ManagedApiKeyEnvironment, NoopManagedApiKeyEnvironment } from "./ManagedApiKeyEnvironment";
import { SessionRunner } from "./SessionRunner";

type DesktopConnectionManagerOptions = {
  databasePath: string;
  agentHomes?: AgentHomes;
  environment: EnvironmentSource;
  managedApiKeyEnvironment?: ManagedApiKeyEnvironment;
  credentialStore: CredentialStore;
  maxPreparedDrafts?: number;
  preparedDraftTtlMs?: number;
};

export class DesktopConnectionManager {
  private static readonly defaultPreparedDraftTtlMs = 5 * 60 * 1000;
  private static readonly defaultMaxPreparedDrafts = 20;

  private readonly localCredentialResolver: LocalCredentialResolver;
  private readonly cursorUsageSessionProbe = CursorUsageSessionSourceProbe.createDefault();
  private readonly sessions: SessionRunner;
  private readonly labeler = new ConnectionLabeler();
  private readonly requestBuilder = new LocalCredentialRequestBuilder();
  private readonly preparedDrafts: DesktopPreparedDraftStore;
  private readonly modelCatalog = new DesktopConnectionModelCatalog();
  private readonly managedApiKeyEnvironment: ManagedApiKeyEnvironment | NoopManagedApiKeyEnvironment;

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
    this.managedApiKeyEnvironment = this.options.managedApiKeyEnvironment ?? new NoopManagedApiKeyEnvironment();
    this.sessions = new SessionRunner(this);
    this.preparedDrafts = new DesktopPreparedDraftStore({
      maxPreparedDrafts: this.options.maxPreparedDrafts ?? DesktopConnectionManager.defaultMaxPreparedDrafts,
      preparedDraftTtlMs: this.options.preparedDraftTtlMs ?? DesktopConnectionManager.defaultPreparedDraftTtlMs,
    });
  }

  async addConnection(input: DesktopAddConnectionInput): Promise<DesktopConnectionSummary> {
    return await this.sessions.runAsync(async (session) => {
      const created = await session.createLocalConnectionWithLocalEffects(
        this.buildLocalConnectionInput(input),
        this.localCredentialResolver,
      );
      const ensured = await this.managedApiKeyEnvironment.ensureForConnection(session, created.id);
      return this.buildConnectionSummary(ensured ?? created);
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
      const ensured = await this.managedApiKeyEnvironment.ensureForConnection(session, updated.id);
      if (input.syncSelectedAgents) {
        for (const selectedAgentId of (ensured ?? updated).selectedByAgents) {
          if (!isAgentId(selectedAgentId)) {
            continue;
          }
          session.useConnection(selectedAgentId, (ensured ?? updated).id);
        }
      }
      return this.buildConnectionSummary(ensured ?? updated);
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
        ? await this.localCredentialResolver.resolveAsync(credentialRequest)
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
      const credential = await this.localCredentialResolver.resolveAsync(this.resolveCredentialRequest(input));
      const onboarding = await session.describeConnectionOnboarding({
        preset: input.preset,
        authMode: input.authMode,
        credential,
        endpointUrl: input.endpointUrl,
        label: input.label?.trim() || undefined,
        allowUndetectedGateway: input.allowUndetectedGateway,
      });
      const id = this.preparedDrafts.save({
        authMode: input.authMode,
        credential,
        endpointUrl: input.endpointUrl,
        onboarding,
        preset: input.preset,
      });
      const labelSuggestion = this.labeler.suggestAccessLabel(input.preset, input.authMode, credential, {
        endpointUrl: input.endpointUrl,
      });
      return {
        id,
        authMode: input.authMode,
        labelSuggestion,
        configurableAgents: onboarding.configurableAgents,
        defaultEnabledAgents: onboarding.defaultEnabledAgents,
      };
    });
  }

  async savePreparedConnection(input: DesktopSavePreparedConnectionInput): Promise<DesktopConnectionSummary> {
    const draft = this.preparedDrafts.read(input.draftId);
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
        const ensured = await this.managedApiKeyEnvironment.ensureForConnection(session, created.id);
        return this.buildConnectionSummary(ensured ?? created);
      });
    } finally {
      this.preparedDrafts.discard(input.draftId);
    }
  }

  discardPreparedConnectionDraft(input: DesktopDiscardPreparedConnectionDraftInput): void {
    this.preparedDrafts.discard(input.draftId);
  }

  async getConnectionModelCatalog(input: DesktopGetConnectionModelCatalogInput): Promise<ConnectionModelCatalogResult> {
    return await this.modelCatalog.read(
      input.connectionId,
      async () =>
        await this.sessions.runAsync(async (session) => {
          return await session.getConnectionModelCatalog(input.connectionId);
        }),
      { forceRefresh: input.forceRefresh },
    );
  }

  clearPreparedConnectionDrafts(): void {
    this.preparedDrafts.clear();
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
    if (input.authMode === "openclaw_openai_session") {
      throw new Error("OpenClaw-only OpenAI sessions cannot be created from the add-connection form");
    }

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
    result: CreateConnectionResult | SavedConnectionSummary,
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
