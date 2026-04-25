import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "../../../services/credential/Store";
import { FileSnapshotStore } from "../../../services/history/FileSnapshotStore";
import { MutationHistory } from "../../../services/history/MutationHistory";
import { SecureSnapshotStore } from "../../../services/history/SecureSnapshotStore";
import { NileLogger } from "../../../services/NileLogger";
import { CurrentStateDetector } from "../current-state/Detector";
import {
  AgentAdapterContextSession,
  type SharedAgentAdapterContext,
} from "../../../runtime-local/AgentAdapterContext";
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
    const context = AgentAdapterContextSession.open(databasePath, options.credentialStore);

    return new RollbackLatestMutation(
      new MutationHistory(
        context.database,
        new FileSnapshotStore(join(dirname(databasePath), "history")),
        options?.secureSnapshotStore ?? new SecureSnapshotStore(),
        logger.child({ scope: "mutation-history" }),
      ),
      context.agentSelection,
      CurrentStateDetector.fromContext(context, {
        codexHome: options?.codexHome ?? join(homedir(), ".codex"),
        credentialStore: options.credentialStore,
        logger: logger.child({ scope: "codex-current-state-detector" }),
      }),
      logger,
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
  ): RollbackLatestMutation {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "codex-rollback-latest" });
    return new RollbackLatestMutation(
      new MutationHistory(
        context.database,
        new FileSnapshotStore(join(dirname(context.databasePath), "history")),
        options?.secureSnapshotStore ?? new SecureSnapshotStore(),
        logger.child({ scope: "mutation-history" }),
      ),
      context.agentSelection,
      CurrentStateDetector.fromContext(context, {
        codexHome: options?.codexHome ?? join(homedir(), ".codex"),
        credentialStore: options.credentialStore,
        logger: logger.child({ scope: "codex-current-state-detector" }),
      }),
      logger,
    );
  }

  constructor(
    private readonly mutationHistory: MutationHistory,
    private readonly agentSelection: SharedAgentAdapterContext["agentSelection"],
    private readonly currentStateDetector: CurrentStateDetector,
    private readonly logger: NileLogger,
    private readonly ownedContext: AgentAdapterContextSession | null = null,
  ) {}

  rollback(): RollbackLatestResult {
    this.logger.info("codex.rollback.start", {});
    const result = this.mutationHistory.rollbackLatest(CODEX_AGENT_ID);
    this.agentSelection.clear(CODEX_AGENT_ID);
    this.currentStateDetector.reconcileAgentSelection();
    this.logger.info("codex.rollback.success", {
      rollbackMutationId: result.rollbackEntry.id,
      rolledBackMutationId: result.rolledBackEntry.id,
    });

    return {
      rolledBackMutationId: result.rolledBackEntry.id,
      rollbackMutationId: result.rollbackEntry.id,
    };
  }

  close(): void {
    this.mutationHistory.close();
    this.currentStateDetector.close();
    this.ownedContext?.close();
  }
}
