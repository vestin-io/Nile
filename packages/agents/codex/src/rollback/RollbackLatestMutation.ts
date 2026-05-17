import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import {
  FileSnapshotStore,
  MutationHistory,
  SecureSnapshotStore,
} from "@nile/core/services/history";
import { NileLogger } from "@nile/core/services/NileLogger";
import { RollbackLatest } from "@nile/core/agents/RollbackLatest";
import { LiveSetupDetector } from "../live-setup/Detector";
import { AgentWorkspaceBinding } from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { CODEX_AGENT_ID } from "../types";

export type RollbackLatestResult = {
  rolledBackMutationId: string;
  rollbackMutationId: string;
};

export class RollbackLatestMutation {
  static open(
    databasePath: string,
    options: {
      codexHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): RollbackLatestMutation {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "codex-rollback-latest" });
    const binding = AgentWorkspaceBinding.open(databasePath, options.credentialStore);

    return new RollbackLatestMutation(
      new RollbackLatest(
        binding.createMutationHistory(
          options?.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.context.agentSelection,
        LiveSetupDetector.fromContext(binding.context, {
          codexHome: options?.codexHome ?? join(homedir(), ".codex"),
          credentialStore: options.credentialStore,
          logger: logger.child({ scope: "codex-live-setup-detector" }),
        }),
        logger,
      ),
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
  ): RollbackLatestMutation {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "codex-rollback-latest" });
    const binding = AgentWorkspaceBinding.fromContext(context);
    return new RollbackLatestMutation(
      new RollbackLatest(
        binding.createMutationHistory(
          options?.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.context.agentSelection,
        LiveSetupDetector.fromContext(binding.context, {
          codexHome: options?.codexHome ?? join(homedir(), ".codex"),
          credentialStore: options.credentialStore,
          logger: logger.child({ scope: "codex-live-setup-detector" }),
        }),
        logger,
      ),
    );
  }

  constructor(
    private readonly rollbackLatest: RollbackLatest,
    private readonly ownedContext: { close(): void } | null = null,
  ) {}

  rollback(): RollbackLatestResult {
    return this.rollbackLatest.execute({
      agentId: CODEX_AGENT_ID,
      startEvent: "codex.rollback.start",
      successEvent: "codex.rollback.success",
    });
  }

  close(): void {
    this.rollbackLatest.close();
    this.ownedContext?.close();
  }
}
