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
} from "../../actions/apply/Support";
import { ApplyMutation } from "../ApplyMutation";
import type { ClaudeProjection } from "../../projection";
import {
  AgentWorkspaceSession,
} from "../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../runtime-local/AgentWorkspaceContext";
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
    const context = AgentWorkspaceSession.open(databasePath, credentialStore);

    return new ApplySelection(
      new ApplyMutation(
        new MutationHistory(
          context.workspaceState.database,
          new FileSnapshotStore(join(dirname(databasePath), "history")),
          options?.secureSnapshotStore ?? new SecureSnapshotStore(),
          logger.child({ scope: "mutation-history" }),
        ),
        new AgentApplySupport(
          CLAUDE_AGENT_ID,
          context.sharedContext.endpointRegistry,
          context.sharedContext.accessRegistry,
          context.agentSelection,
          context.sharedContext.agentConnectionSettings,
          credentialStore,
          logger,
          (message) => new ApplySelectionValidationError(message),
        ),
        logger,
      ),
      new ClaudeSettingsStore(claudeHome),
      new ClaudeCredentialStore(claudeHome),
      context,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
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
      new ApplyMutation(
        new MutationHistory(
          context.database,
          new FileSnapshotStore(join(dirname(context.databasePath), "history")),
          options?.secureSnapshotStore ?? new SecureSnapshotStore(),
          logger.child({ scope: "mutation-history" }),
        ),
        new AgentApplySupport(
          CLAUDE_AGENT_ID,
          context.endpointRegistry,
          context.accessRegistry,
          context.agentSelection,
          context.agentConnectionSettings,
          credentialStore,
          logger,
          (message) => new ApplySelectionValidationError(message),
        ),
        logger,
      ),
      new ClaudeSettingsStore(claudeHome),
      new ClaudeCredentialStore(claudeHome),
    );
  }

  constructor(
    private readonly applyMutation: ApplyMutation,
    private readonly settingsStore: ClaudeSettingsStore,
    private readonly credentialStore: ClaudeCredentialStore,
    private readonly ownedContext: AgentWorkspaceSession | null = null,
  ) {}

  apply(connectionId: string) {
    const settingsSnapshot = this.settingsStore.snapshot();
    const credentialSnapshot = this.credentialStore.snapshot();
    return this.applyMutation.execute({
      agentId: CLAUDE_AGENT_ID,
      connectionId,
      historyMarkFailedEvent: "claude.apply.history_mark_failed",
      buildFiles: () => [
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
      apply: (prepared) => {
        const projection = this.requireClaudeProjection(prepared.projection);
        if (prepared.access.authMode === "claude_session") {
          this.applySession(prepared.credential, projection.baseUrl);
          return;
        }

        this.applyApiKey(prepared.credential, projection.baseUrl, projection.envKey);
      },
      readAppliedFiles: () => [
        { path: this.settingsStore.settingsPath, content: this.settingsStore.snapshot() },
        { path: this.credentialStore.credentialsPath, content: this.credentialStore.snapshot() },
      ],
      restore: () => {
        this.credentialStore.restore(credentialSnapshot);
        this.settingsStore.restore(settingsSnapshot);
      },
    });
  }

  close(): void {
    this.applyMutation.close();
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
