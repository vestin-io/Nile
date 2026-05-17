import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import {
  FileSnapshotStore,
  MutationHistory,
  SecureSnapshotStore,
} from "@nile/core/services/history";
import { NileLogger } from "@nile/core/services/NileLogger";
import { ApplySelectionValidationError } from "@nile/core/agents/ApplySelectionValidationError";
import {
  AgentApplySupport,
  type PreparedAgentApplySelection,
} from "@nile/core/actions/apply";
import { ApplyMutation } from "@nile/core/agents/ApplyMutation";
import { AgentWorkspaceBinding } from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { CODEX_AGENT_ID } from "../types";
import { CODEX_PROJECTION } from "../Projection";
import type { CodexProjection } from "../ProjectionTypes";
import { CodexAuthStore } from "../stores/CodexAuthStore";
import { CodexConfigStore } from "../stores/CodexConfigStore";

export { ApplySelectionValidationError };

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
    const binding = AgentWorkspaceBinding.open(databasePath, credentialStore);

    return new ApplySelection(
      new ApplyMutation(
        binding.createMutationHistory(
          options?.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.createApplySupport(
          CODEX_AGENT_ID,
          credentialStore,
          logger,
          (message: string) => new ApplySelectionValidationError(message),
          CODEX_PROJECTION.resolve,
        ),
        logger,
      ),
      new CodexAuthStore({ codexHome }),
      new CodexConfigStore(codexHome),
      binding,
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
    const binding = AgentWorkspaceBinding.fromContext(context);

    return new ApplySelection(
      new ApplyMutation(
        binding.createMutationHistory(
          options?.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.createApplySupport(
          CODEX_AGENT_ID,
          credentialStore,
          logger,
          (message: string) => new ApplySelectionValidationError(message),
          CODEX_PROJECTION.resolve,
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
    private readonly ownedContext: { close(): void } | null = null,
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
