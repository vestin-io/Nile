import { type LocalCredentialRequest } from "@nile/builtins/local";
import type { ConnectionPresetFamily } from "@nile/core/models/connection";
import type { SavedConnectionSummary } from "@nile/core/models/connection";
import type { ConnectionModelCatalogResult, CreateConnectionResult } from "@nile/core/models/connection";
import { ConnectionLabeler } from "@nile/builtins/connections";
import {
  NileSession,
} from "@nile/builtins/runtime";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import {
  INTERACTIVE_SESSION_LOGIN_REGISTRY,
  type InteractiveSessionLoginRegistry,
} from "@nile/builtins/session";
import {
  type CredentialStorageBackend,
  type CredentialStore,
} from "@nile/core/services/credential";
import { isAgentId, type AgentHomes, type AgentRuntimeCommandOverrides } from "@nile/core/models/agent";
import { LocalCredentialResolver } from "@nile/builtins/local";
import {
  runWithCursorUsageWorkspace,
  type ConnectionChangeResult,
} from "@nile/builtins/cursor-usage";

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
import { CursorUsageSessionProbeFactory } from "./CursorUsageSessionProbeFactory";
import { DesktopCredentialStorageSession } from "./CredentialStorageSession";
import { DesktopConnectionInputBuilder } from "./InputBuilder";
import { DesktopConnectionModelCatalog } from "./ModelCatalog";
import { DesktopPreparedDraftStore } from "./DesktopPreparedDraftStore";
import { ManagedApiKeyEnvironment, NoopManagedApiKeyEnvironment } from "./ManagedApiKeyEnvironment";
import { SessionRunner } from "./SessionRunner";
import { DesktopConnectionStorageSupport } from "./StorageSupport";
import { resolveDesktopCredentialStorageMode } from "./CredentialStorageMode";

type DesktopConnectionManagerOptions = {
  databasePath: string;
  agentHomes?: AgentHomes;
  agentRuntimeCommandOverrides?: AgentRuntimeCommandOverrides;
  environment: EnvironmentSource;
  openExternalUrl?: (url: string) => Promise<void>;
  managedApiKeyEnvironment?: ManagedApiKeyEnvironment;
  credentialStore: CredentialStore;
  credentialStorageSession?: DesktopCredentialStorageSession;
  maxPreparedDrafts?: number;
  preparedDraftTtlMs?: number;
};

export class DesktopConnectionManager {
  private static readonly defaultPreparedDraftTtlMs = 5 * 60 * 1000;
  private static readonly defaultMaxPreparedDrafts = 20;

  private readonly localCredentialResolver: LocalCredentialResolver;
  private readonly cursorUsageSessionProbeFactory = new CursorUsageSessionProbeFactory();
  private readonly sessions: SessionRunner;
  private readonly labeler = new ConnectionLabeler();
  private readonly inputs = new DesktopConnectionInputBuilder();
  private readonly preparedDrafts: DesktopPreparedDraftStore;
  private readonly modelCatalog = new DesktopConnectionModelCatalog();
  private readonly managedApiKeyEnvironment: ManagedApiKeyEnvironment | NoopManagedApiKeyEnvironment;
  private readonly storage: DesktopConnectionStorageSupport;

  constructor(
    private readonly options: DesktopConnectionManagerOptions,
    interactiveSessionLoginRegistry: Pick<InteractiveSessionLoginRegistry, "signInAndRead"> =
      INTERACTIVE_SESSION_LOGIN_REGISTRY,
  ) {
    this.localCredentialResolver = new LocalCredentialResolver(
      this.options.agentHomes,
      this.options.environment,
      interactiveSessionLoginRegistry,
      this.options.openExternalUrl,
      this.options.agentRuntimeCommandOverrides,
    );
    this.managedApiKeyEnvironment = this.options.managedApiKeyEnvironment ?? new NoopManagedApiKeyEnvironment();
    this.sessions = new SessionRunner(this);
    this.storage = new DesktopConnectionStorageSupport(this.options.credentialStorageSession ?? null);
    this.preparedDrafts = new DesktopPreparedDraftStore({
      maxPreparedDrafts: this.options.maxPreparedDrafts ?? DesktopConnectionManager.defaultMaxPreparedDrafts,
      preparedDraftTtlMs: this.options.preparedDraftTtlMs ?? DesktopConnectionManager.defaultPreparedDraftTtlMs,
    });
  }

  async addConnection(input: DesktopAddConnectionInput): Promise<DesktopConnectionSummary> {
    try {
      return await this.sessions.runAsync(async (session) => {
        const credentialStorageBackend = resolveDesktopCredentialStorageMode(
          session,
          input.credentialStorageBackend,
        );
        this.storage.prepare(credentialStorageBackend, input.encryptedLocalPassphrase, {
          allowCreate: true,
        });
        const created = this.applyCursorUsageFollowUp(
          await session.createLocalConnection(
            this.inputs.buildLocalConnectionInput(input, credentialStorageBackend),
            this.localCredentialResolver,
          ),
        );
        const ensured = await this.managedApiKeyEnvironment.ensureForConnection(session, created.id);
        return this.buildConnectionSummary(ensured ?? created);
      });
    } catch (error) {
      throw this.storage.mapError(error, input.credentialStorageBackend);
    }
  }

  async updateConnection(input: DesktopUpdateConnectionInput): Promise<DesktopConnectionSummary> {
    let credentialStorageBackend: CredentialStorageBackend | undefined;
    try {
      return await this.sessions.runAsync(async (session) => {
        const existing = session.listSavedConnections().find((connection) => connection.id === input.connectionId);
        if (!existing) {
          throw new Error(`Connection not found: ${input.connectionId}`);
        }
        credentialStorageBackend = existing.credentialStorageBackend;
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
    } catch (error) {
      throw this.storage.mapError(error, credentialStorageBackend);
    }
  }

  async describeConnectionOnboarding(input: DesktopAddConnectionInput) {
      return await this.sessions.runAsync(async (session) =>
        await session.describeLocalConnectionOnboarding(
          this.inputs.buildLocalConnectionInput(
            input,
            resolveDesktopCredentialStorageMode(session, input.credentialStorageBackend),
        ),
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
        credentialStorageBackend: existing.credentialStorageBackend ?? "system_secure_storage",
        probeCredential: this.inputs.resolveProbeCredential(credentialRequest, credential, this.localCredentialResolver),
        endpointUrl: input.endpointUrl?.trim() || existing.endpointUrl || undefined,
      });
    });
  }

  async prepareConnectionDraft(input: DesktopAddConnectionInput): Promise<DesktopPreparedConnectionDraft> {
    try {
      return await this.sessions.runAsync(async (session) => {
        const credentialStorageBackend = resolveDesktopCredentialStorageMode(
          session,
          input.credentialStorageBackend,
        );
        this.storage.prepare(credentialStorageBackend, input.encryptedLocalPassphrase, {
          allowCreate: false,
        });
        const credential = await this.localCredentialResolver.resolveAsync(this.resolveCredentialRequest(input));
        const onboarding = await session.describeConnectionOnboarding({
          preset: input.preset,
          authMode: input.authMode,
          credential,
          credentialStorageBackend,
          endpointUrl: input.endpointUrl,
          label: input.label?.trim() || undefined,
          allowUndetectedGateway: input.allowUndetectedGateway,
        });
        const id = this.preparedDrafts.save({
          authMode: input.authMode,
          credential,
          credentialStorageBackend,
          encryptedLocalPassphrase: input.encryptedLocalPassphrase?.trim() || undefined,
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
    } catch (error) {
      throw this.storage.mapError(error, input.credentialStorageBackend);
    }
  }

  async savePreparedConnection(input: DesktopSavePreparedConnectionInput): Promise<DesktopConnectionSummary> {
    const draft = this.preparedDrafts.read(input.draftId);
    if (!draft) {
      throw new Error("Prepared connection draft not found");
    }

    try {
      return await this.sessions.runAsync(async (session) => {
        const credentialStorageBackend = resolveDesktopCredentialStorageMode(
          session,
          draft.credentialStorageBackend,
        );
        this.storage.prepare(credentialStorageBackend, draft.encryptedLocalPassphrase, {
          allowCreate: true,
        });
        const created = this.applyCursorUsageFollowUp(await session.createConnection({
          preset: draft.preset,
          authMode: draft.authMode,
          credential: draft.credential,
          credentialStorageBackend,
          endpointUrl: draft.endpointUrl,
          label: input.label?.trim() || undefined,
          enabledAgents: input.enabledAgents ?? draft.onboarding.defaultEnabledAgents,
        }));
        const ensured = await this.managedApiKeyEnvironment.ensureForConnection(session, created.id);
        return this.buildConnectionSummary(ensured ?? created);
      });
    } catch (error) {
      throw this.storage.mapError(error, draft.credentialStorageBackend);
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

  getCredentialStorageState() {
    return this.options.credentialStorageSession?.readState() ?? {
      encryptedLocalVaultExists: false,
      encryptedLocalUnlocked: false,
    };
  }

  unlockEncryptedLocalStorage(passphrase: string): void {
    this.storage.unlockEncryptedLocalStorage(passphrase);
  }

  private resolveCredentialRequest(input: DesktopAddConnectionInput): LocalCredentialRequest {
    return this.inputs.resolveCredentialRequest(input);
  }

  private resolvePresetForSavedConnection(connection: SavedConnectionSummary): ConnectionPresetFamily {
    if (
      !connection.endpointFamily
      || connection.endpointFamily === "cursor"
      || connection.endpointFamily === "gemini"
    ) {
      throw new Error(`Connection ${connection.id} does not support capability detection`);
    }
    return connection.endpointFamily;
  }

  private resolveUpdateCredentialRequest(
    input: DesktopUpdateConnectionInput,
    authMode: SavedConnectionSummary["authMode"],
  ): LocalCredentialRequest | undefined {
    return this.inputs.resolveUpdateCredentialRequest(input, authMode);
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
    });
  }

  private applyCursorUsageFollowUp<T extends ConnectionChangeResult>(result: T): T {
    return runWithCursorUsageWorkspace({
      databasePath: this.options.databasePath,
      credentialStore: this.options.credentialStore,
      sessionProbe: this.cursorUsageSessionProbeFactory.create(this.options.agentHomes),
    }, (workspace) => workspace.applyFollowUp(result));
  }

}
