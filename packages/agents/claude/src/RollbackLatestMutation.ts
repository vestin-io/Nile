import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { FileSnapshotStore } from "@nile/core/services/history";
import { MutationHistory } from "@nile/core/services/history";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { NileLogger } from "@nile/core/services/NileLogger";
import { RollbackLatest } from "@nile/core/agents/RollbackLatest";
import {
  AgentWorkspaceBinding,
} from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { CLAUDE_AGENT_ID } from "./types";
import { LiveSetupDetector } from "./live-setup/Detector";

export type RollbackLatestResult = {
  rolledBackMutationId: string;
  rollbackMutationId: string;
};

export class RollbackLatestMutation {
  static open(
    databasePath: string,
    options: {
      claudeHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): RollbackLatestMutation {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "claude-rollback-latest" });
    const binding = AgentWorkspaceBinding.open(databasePath, options.credentialStore);
    return new RollbackLatestMutation(
      new RollbackLatest(
        binding.createMutationHistory(
          options?.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.context.agentSelection,
        LiveSetupDetector.fromContext(binding.context, {
          claudeHome: options?.claudeHome ?? join(homedir(), ".claude"),
          credentialStore: options.credentialStore,
          logger: logger.child({ scope: "claude-live-setup-detector" }),
        }),
        logger,
      ),
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
  ): RollbackLatestMutation {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "claude-rollback-latest" });
    const binding = AgentWorkspaceBinding.fromContext(context);
    return new RollbackLatestMutation(
      new RollbackLatest(
        binding.createMutationHistory(
          options?.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.context.agentSelection,
        LiveSetupDetector.fromContext(binding.context, {
          claudeHome: options?.claudeHome ?? join(homedir(), ".claude"),
          credentialStore: options.credentialStore,
          logger: logger.child({ scope: "claude-live-setup-detector" }),
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
      agentId: CLAUDE_AGENT_ID,
      startEvent: "claude.rollback.start",
      successEvent: "claude.rollback.success",
    });
  }

  close(): void {
    this.rollbackLatest.close();
    this.ownedContext?.close();
  }
}
