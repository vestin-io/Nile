import { homedir } from "node:os";
import { join } from "node:path";

import { RollbackLatest } from "@nile/core/agents/RollbackLatest";
import type { CredentialStore } from "@nile/core/services/credential";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { NileLogger } from "@nile/core/services/NileLogger";
import { AgentWorkspaceBinding } from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { LiveSetupDetector } from "./live-setup/Detector";
import { OPENCODE_AGENT_ID } from "./types";

export type RollbackLatestResult = {
  rolledBackMutationId: string;
  rollbackMutationId: string;
};

export class RollbackLatestMutation {
  static open(
    databasePath: string,
    options: {
      opencodeHome?: string;
      opencodeDataHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): RollbackLatestMutation {
    const logger = options.logger ?? NileLogger.silent().child({ module: "opencode-rollback-latest" });
    const binding = AgentWorkspaceBinding.open(databasePath, options.credentialStore);

    return new RollbackLatestMutation(
      new RollbackLatest(
        binding.createMutationHistory(
          options.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.context.agentSelection,
        LiveSetupDetector.fromContext(binding.context, {
          opencodeHome: options.opencodeHome ?? join(homedir(), ".config", "opencode"),
          opencodeDataHome: options.opencodeDataHome ?? join(homedir(), ".local", "share", "opencode"),
          credentialStore: options.credentialStore,
          logger: logger.child({ scope: "opencode-live-setup-detector" }),
        }),
        logger,
      ),
      binding,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      opencodeHome?: string;
      opencodeDataHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): RollbackLatestMutation {
    const logger = options.logger ?? NileLogger.silent().child({ module: "opencode-rollback-latest" });
    const binding = AgentWorkspaceBinding.fromContext(context);

    return new RollbackLatestMutation(
      new RollbackLatest(
        binding.createMutationHistory(
          options.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.context.agentSelection,
        LiveSetupDetector.fromContext(binding.context, {
          opencodeHome: options.opencodeHome ?? join(homedir(), ".config", "opencode"),
          opencodeDataHome: options.opencodeDataHome ?? join(homedir(), ".local", "share", "opencode"),
          credentialStore: options.credentialStore,
          logger: logger.child({ scope: "opencode-live-setup-detector" }),
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
      agentId: OPENCODE_AGENT_ID,
      startEvent: "opencode.rollback.start",
      successEvent: "opencode.rollback.success",
    });
  }

  close(): void {
    this.rollbackLatest.close();
    this.ownedContext?.close();
  }
}
