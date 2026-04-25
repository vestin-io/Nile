import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { FileSnapshotStore } from "../../services/history/FileSnapshotStore";
import { MutationHistory } from "../../services/history/MutationHistory";
import { SecureSnapshotStore } from "../../services/history/SecureSnapshotStore";
import { NileLogger } from "../../services/NileLogger";
import {
  AgentAdapterContextSession,
  type SharedAgentAdapterContext,
} from "../../runtime-local/AgentAdapterContext";
import { OPENCLAW_AGENT_ID } from "./types";
import { CurrentStateDetector } from "./current-state/Detector";

export type RollbackLatestResult = {
  rolledBackMutationId: string;
  rollbackMutationId: string;
};

export class RollbackLatestMutation {
  static open(
    databasePath: string,
    options: {
      openclawHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): RollbackLatestMutation {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-rollback-latest" });
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
        openclawHome: options?.openclawHome ?? join(homedir(), ".openclaw"),
        credentialStore: options.credentialStore,
        logger: logger.child({ scope: "openclaw-current-state-detector" }),
      }),
      logger,
      context,
    );
  }

  static fromContext(
    context: SharedAgentAdapterContext,
    options: {
      openclawHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): RollbackLatestMutation {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-rollback-latest" });
    return new RollbackLatestMutation(
      new MutationHistory(
        context.database,
        new FileSnapshotStore(join(dirname(context.databasePath), "history")),
        options?.secureSnapshotStore ?? new SecureSnapshotStore(),
        logger.child({ scope: "mutation-history" }),
      ),
      context.agentSelection,
      CurrentStateDetector.fromContext(context, {
        openclawHome: options?.openclawHome ?? join(homedir(), ".openclaw"),
        credentialStore: options.credentialStore,
        logger: logger.child({ scope: "openclaw-current-state-detector" }),
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
    this.logger.info("openclaw.rollback.start", {});
    const result = this.mutationHistory.rollbackLatest(OPENCLAW_AGENT_ID);
    this.agentSelection.clear(OPENCLAW_AGENT_ID);
    this.currentStateDetector.reconcileAgentSelection();
    this.logger.info("openclaw.rollback.success", {
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
