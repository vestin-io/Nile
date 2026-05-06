import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "../../../services/credential/Store";
import { FileSnapshotStore } from "../../../services/history/FileSnapshotStore";
import { MutationHistory } from "../../../services/history/MutationHistory";
import { SecureSnapshotStore } from "../../../services/history/SecureSnapshotStore";
import { NileLogger } from "../../../services/NileLogger";
import { AgentApplySupport } from "../../../actions/apply/Support";
import type { PreparedAgentApplySelection } from "../../../actions/apply/Support";
import { ApplyMutation } from "../../ApplyMutation";
import type { CodexProjection } from "../../../projection";
import {
  AgentWorkspaceSession,
} from "../../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../../runtime-local/AgentWorkspaceContext";
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
    const context = AgentWorkspaceSession.open(databasePath, credentialStore);

    return new ApplySelection(
      new ApplyMutation(
        new MutationHistory(
          context.workspaceState.database,
          new FileSnapshotStore(historyRoot),
          options?.secureSnapshotStore ?? new SecureSnapshotStore(),
          logger.child({ scope: "mutation-history" }),
        ),
        createApplySupport(
          context.sharedContext.endpointRegistry,
          context.sharedContext.accessRegistry,
          context.agentSelection,
          logger,
          credentialStore,
        ),
        logger,
      ),
      new CodexAuthStore({ codexHome }),
      new CodexConfigStore(codexHome),
      context,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
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
      new ApplyMutation(
        new MutationHistory(
          context.database,
          new FileSnapshotStore(historyRoot),
          options?.secureSnapshotStore ?? new SecureSnapshotStore(),
          logger.child({ scope: "mutation-history" }),
        ),
        createApplySupport(
          context.endpointRegistry,
          context.accessRegistry,
          context.agentSelection,
          logger,
          credentialStore,
        ),
        logger,
      ),
      new CodexAuthStore({ codexHome }),
      new CodexConfigStore(codexHome),
    );
  }

  constructor(
    private readonly applyMutation: ApplyMutation,
    private readonly authStore: CodexAuthStore,
    private readonly configStore: CodexConfigStore,
    private readonly ownedContext: AgentWorkspaceSession | null = null,
  ) {}

  apply(connectionId: string) {
    const authSnapshot = this.authStore.snapshot();
    const configSnapshot = this.configStore.snapshot();
    return this.applyMutation.execute({
      agentId: CODEX_AGENT_ID,
      connectionId,
      historyMarkFailedEvent: "codex.apply.history_mark_failed",
      buildFiles: () => [
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
      apply: (prepared) => {
        this.authStore.apply(prepared.credential);
        this.configStore.applyProjection(this.requireCodexProjection(prepared.projection));
      },
      readAppliedFiles: () => [
        { path: this.authStore.authPath, content: this.authStore.snapshot() },
        { path: this.configStore.configPath, content: this.configStore.snapshot() },
      ],
      restore: () => {
        this.authStore.restore(authSnapshot);
        this.configStore.restore(configSnapshot);
      },
    });
  }

  close(): void {
    this.applyMutation.close();
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
  endpointRegistry: AgentWorkspaceContext["endpointRegistry"],
  accessRegistry: AgentWorkspaceContext["accessRegistry"],
  agentSelection: AgentWorkspaceContext["agentSelection"],
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
