import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { isDirectApiKeyCredential, type StoredCredential } from "@nile/core/services/credential";
import type { CredentialStore } from "@nile/core/services/credential";
import { FileSnapshotStore } from "@nile/core/services/history";
import { MutationHistory } from "@nile/core/services/history";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { NileLogger } from "@nile/core/services/NileLogger";
import { ApplySelectionValidationError } from "@nile/core/agents/ApplySelectionValidationError";
import {
  AgentApplySupport,
  type PreparedAgentApplySelection,
} from "@nile/core/actions/apply";
import { ApplyMutation } from "@nile/core/agents/ApplyMutation";
import {
  AgentWorkspaceBinding,
} from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { CLAUDE_AGENT_ID } from "./types";
import { CLAUDE_PROJECTION } from "./Projection";
import type { ClaudeProjection } from "./ProjectionTypes";
import { ClaudeCredentialStore } from "./Store";
import { ClaudeSettingsStore } from "./SettingsStore";

export { ApplySelectionValidationError };

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
    const binding = AgentWorkspaceBinding.open(databasePath, credentialStore);

    return new ApplySelection(
      new ApplyMutation(
        binding.createMutationHistory(
          options?.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.createApplySupport(
          CLAUDE_AGENT_ID,
          credentialStore,
          logger,
          (message: string) => new ApplySelectionValidationError(message),
          CLAUDE_PROJECTION.resolve,
        ),
        logger,
      ),
      new ClaudeSettingsStore(claudeHome),
      new ClaudeCredentialStore(claudeHome),
      binding,
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
    const binding = AgentWorkspaceBinding.fromContext(context);

    return new ApplySelection(
      new ApplyMutation(
        binding.createMutationHistory(
          options?.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.createApplySupport(
          CLAUDE_AGENT_ID,
          credentialStore,
          logger,
          (message: string) => new ApplySelectionValidationError(message),
          CLAUDE_PROJECTION.resolve,
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
    private readonly ownedContext: { close(): void } | null = null,
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
