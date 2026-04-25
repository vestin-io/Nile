import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { isDirectApiKeyCredential, type StoredCredential } from "../../services/credential/Types";
import type { CredentialStore } from "../../services/credential/Store";
import { FileSnapshotStore } from "../../services/history/FileSnapshotStore";
import { MutationHistory } from "../../services/history/MutationHistory";
import { SecureSnapshotStore } from "../../services/history/SecureSnapshotStore";
import { NileLogger } from "../../services/NileLogger";
import {
  AgentApplySupport,
  type PreparedAgentApplySelection,
} from "../../actions/use/ApplySupport";
import type { ClaudeProjection } from "../../projection";
import {
  AgentAdapterContextSession,
  type SharedAgentAdapterContext,
} from "../../runtime-local/AgentAdapterContext";
import { CLAUDE_AGENT_ID } from "./types";
import { ClaudeCredentialStore } from "./Store";
import { ClaudeSettingsStore } from "./SettingsStore";

export class ApplySelectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplySelectionValidationError";
  }
}

export class ApplySelection {
  static open(
    databasePath: string,
    options: {
      claudeHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): ApplySelection {
    const claudeHome = options?.claudeHome ?? join(homedir(), ".claude");
    const credentialStore = options.credentialStore;
    const logger = options?.logger ?? NileLogger.silent().child({ module: "claude-apply-selection" });
    const context = AgentAdapterContextSession.open(databasePath, credentialStore);

    return new ApplySelection(
      new MutationHistory(
        context.database,
        new FileSnapshotStore(join(dirname(databasePath), "history")),
        options?.secureSnapshotStore ?? new SecureSnapshotStore(),
        logger.child({ scope: "mutation-history" }),
      ),
      new ClaudeSettingsStore(claudeHome),
      new ClaudeCredentialStore(claudeHome),
      new AgentApplySupport(
        CLAUDE_AGENT_ID,
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        credentialStore,
        logger,
        (message) => new ApplySelectionValidationError(message),
      ),
      context,
    );
  }

  static fromContext(
    context: SharedAgentAdapterContext,
    options: {
      claudeHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): ApplySelection {
    const claudeHome = options?.claudeHome ?? join(homedir(), ".claude");
    const credentialStore = options.credentialStore;
    const logger = options?.logger ?? NileLogger.silent().child({ module: "claude-apply-selection" });

    return new ApplySelection(
      new MutationHistory(
        context.database,
        new FileSnapshotStore(join(dirname(context.databasePath), "history")),
        options?.secureSnapshotStore ?? new SecureSnapshotStore(),
        logger.child({ scope: "mutation-history" }),
      ),
      new ClaudeSettingsStore(claudeHome),
      new ClaudeCredentialStore(claudeHome),
      new AgentApplySupport(
        CLAUDE_AGENT_ID,
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        credentialStore,
        logger,
        (message) => new ApplySelectionValidationError(message),
      ),
    );
  }

  constructor(
    private readonly mutationHistory: MutationHistory,
    private readonly settingsStore: ClaudeSettingsStore,
    private readonly credentialStore: ClaudeCredentialStore,
    private readonly applySupport: AgentApplySupport,
    private readonly ownedContext: AgentAdapterContextSession | null = null,
  ) {}

  apply(connectionId: string) {
    const prepared = this.applySupport.prepare(connectionId);
    const projection = this.requireClaudeProjection(prepared.projection);
    const settingsSnapshot = this.settingsStore.snapshot();
    const credentialSnapshot = this.credentialStore.snapshot();
    const mutation = this.mutationHistory.start({
      agentId: CLAUDE_AGENT_ID,
      type: "apply_selection",
      connectionId: prepared.connectionId,
      connectionLabel: prepared.connection.label,
      endpointLabel: prepared.endpoint.label,
      accessLabel: prepared.access.label,
      files: [
        {
          path: this.settingsStore.settingsPath,
          content: settingsSnapshot,
          existedBefore: settingsSnapshot !== null,
          isSensitive: true,
        },
        {
          path: this.credentialStore.credentialsPath,
          content: credentialSnapshot,
          existedBefore: credentialSnapshot !== null,
          isSensitive: true,
        },
      ],
    });

    try {
      if (prepared.access.authMode === "claude_session") {
        this.applySession(prepared.credential, projection.baseUrl);
      } else {
        this.applyApiKey(prepared.credential, projection.baseUrl, projection.envKey);
      }
      this.mutationHistory.markApplied(mutation.id, [
        { path: this.settingsStore.settingsPath, content: this.settingsStore.snapshot() },
        { path: this.credentialStore.credentialsPath, content: this.credentialStore.snapshot() },
      ]);
    } catch (error) {
      this.credentialStore.restore(credentialSnapshot);
      this.settingsStore.restore(settingsSnapshot);
      this.mutationHistory.markFailed(mutation.id, error instanceof Error ? error.message : String(error));
      this.applySupport.logRollback(error, prepared);
      throw error;
    }

    return this.applySupport.complete(prepared);
  }

  close(): void {
    this.mutationHistory.close();
    this.ownedContext?.close();
  }

  private requireClaudeProjection(
    projection: PreparedAgentApplySelection["projection"],
  ): ClaudeProjection {
    if (projection.agentId !== CLAUDE_AGENT_ID) {
      throw new ApplySelectionValidationError(
        `Expected a claude projection but received ${projection.agentId}`,
      );
    }
    return projection as ClaudeProjection;
  }

  private applyApiKey(
    credential: StoredCredential,
    baseUrl: string,
    envKey?: string,
  ): void {
    if (!isDirectApiKeyCredential(credential)) {
      throw new ApplySelectionValidationError("Claude API-key connections require an api_key credential");
    }

    this.settingsStore.applyApiKey(
      credential.apiKey,
      baseUrl,
      envKey as "ANTHROPIC_API_KEY" | "ANTHROPIC_AUTH_TOKEN" | undefined,
    );
  }

  private applySession(credential: StoredCredential, _baseUrl: string): void {
    if (credential.kind !== "claude_session") {
      throw new ApplySelectionValidationError("Claude session connections require a claude_session credential");
    }
    if (!credential.accountUuid?.trim() || !credential.email?.trim()) {
      throw new ApplySelectionValidationError("Claude session credentials require account identity metadata");
    }

    this.credentialStore.applyOauth({
      accessToken: credential.accessToken,
      refreshToken: credential.refreshToken,
      ...(typeof credential.expiresAt === "number" ? { expiresAt: credential.expiresAt } : {}),
    });
    this.settingsStore.applySession({
      emailAddress: credential.email,
      accountUuid: credential.accountUuid,
      organizationUuid: credential.organizationUuid,
      displayName: credential.displayName,
    });
  }
}
