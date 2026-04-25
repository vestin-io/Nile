import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "../../../services/credential/Store";
import { FileSnapshotStore } from "../../../services/history/FileSnapshotStore";
import { MutationHistory } from "../../../services/history/MutationHistory";
import { SecureSnapshotStore } from "../../../services/history/SecureSnapshotStore";
import { NileLogger } from "../../../services/NileLogger";
import { AgentApplySupport } from "../../../actions/use/ApplySupport";
import type { PreparedAgentApplySelection } from "../../../actions/use/ApplySupport";
import type { CodexProjection } from "../../../projection";
import {
  AgentAdapterContextSession,
  type SharedAgentAdapterContext,
} from "../../../runtime-local/AgentAdapterContext";
import { CODEX_AGENT_ID } from "../types";
import { CodexAuthStore } from "../stores/CodexAuthStore";
import { CodexConfigStore } from "../stores/CodexConfigStore";

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
      codexHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): ApplySelection {
    const codexHome = options?.codexHome ?? join(homedir(), ".codex");
    const credentialStore = options.credentialStore;
    const logger = options?.logger ?? NileLogger.silent().child({ module: "codex-apply-selection" });
    const historyRoot = join(dirname(databasePath), "history");
    const context = AgentAdapterContextSession.open(databasePath, credentialStore);

    return new ApplySelection(
      new MutationHistory(
        context.database,
        new FileSnapshotStore(historyRoot),
        options?.secureSnapshotStore ?? new SecureSnapshotStore(),
        logger.child({ scope: "mutation-history" }),
      ),
      new CodexAuthStore({ codexHome }),
      new CodexConfigStore(codexHome),
      logger,
      createApplySupport(
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        logger,
        credentialStore,
      ),
      context,
    );
  }

  static fromContext(
    context: SharedAgentAdapterContext,
    options: {
      codexHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): ApplySelection {
    const codexHome = options?.codexHome ?? join(homedir(), ".codex");
    const credentialStore = options.credentialStore;
    const logger = options?.logger ?? NileLogger.silent().child({ module: "codex-apply-selection" });
    const historyRoot = join(dirname(context.databasePath), "history");

    return new ApplySelection(
      new MutationHistory(
        context.database,
        new FileSnapshotStore(historyRoot),
        options?.secureSnapshotStore ?? new SecureSnapshotStore(),
        logger.child({ scope: "mutation-history" }),
      ),
      new CodexAuthStore({ codexHome }),
      new CodexConfigStore(codexHome),
      logger,
      createApplySupport(
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        logger,
        credentialStore,
      ),
    );
  }

  constructor(
    private readonly mutationHistory: MutationHistory,
    private readonly authStore: CodexAuthStore,
    private readonly configStore: CodexConfigStore,
    private readonly logger: NileLogger,
    private readonly applySupport: AgentApplySupport,
    private readonly ownedContext: AgentAdapterContextSession | null = null,
  ) {}

  apply(connectionId: string) {
    const prepared = this.applySupport.prepare(connectionId);
    const authSnapshot = this.authStore.snapshot();
    const configSnapshot = this.configStore.snapshot();
    const mutation = this.mutationHistory.start({
      agentId: CODEX_AGENT_ID,
      type: "apply_selection",
      connectionId: prepared.connectionId,
      connectionLabel: prepared.connection.label,
      endpointLabel: prepared.endpoint.label,
      accessLabel: prepared.access.label,
      files: [
        {
          path: this.authStore.authPath,
          content: authSnapshot,
          existedBefore: authSnapshot !== null,
          isSensitive: true,
        },
        {
          path: this.configStore.configPath,
          content: configSnapshot,
          existedBefore: configSnapshot !== null,
        },
      ],
    });

    try {
      this.authStore.apply(prepared.credential);
      this.configStore.applyProjection(this.requireCodexProjection(prepared.projection));
      this.mutationHistory.markApplied(mutation.id, [
        { path: this.authStore.authPath, content: this.authStore.snapshot() },
        { path: this.configStore.configPath, content: this.configStore.snapshot() },
      ]);
    } catch (error) {
      this.authStore.restore(authSnapshot);
      this.configStore.restore(configSnapshot);
      try {
        this.mutationHistory.markFailed(
          mutation.id,
          error instanceof Error ? error.message : String(error),
        );
      } catch (historyError) {
        this.logger.error("codex.apply.history_mark_failed", historyError, {
          mutationId: mutation.id,
        });
      }
      this.applySupport.logRollback(error, prepared);
      throw error;
    }

    return this.applySupport.complete(prepared);
  }

  close(): void {
    this.ownedContext?.close();
  }

  private requireCodexProjection(
    projection: PreparedAgentApplySelection["projection"],
  ): CodexProjection {
    if (projection.agentId !== CODEX_AGENT_ID) {
      throw new ApplySelectionValidationError(
        `Expected a codex projection but received ${projection.agentId}`,
      );
    }
    return projection as CodexProjection;
  }
}

function createApplySupport(
  endpointRegistry: SharedAgentAdapterContext["endpointRegistry"],
  accessRegistry: SharedAgentAdapterContext["accessRegistry"],
  agentSelection: SharedAgentAdapterContext["agentSelection"],
  logger: NileLogger,
  credentialStore: CredentialStore,
): AgentApplySupport {
  return new AgentApplySupport(
    CODEX_AGENT_ID,
    endpointRegistry,
    accessRegistry,
    agentSelection,
    credentialStore,
    logger,
    (message) => new ApplySelectionValidationError(message),
  );
}
