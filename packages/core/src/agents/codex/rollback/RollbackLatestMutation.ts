import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "../../../services/credential/Store";
import { FileSnapshotStore } from "../../../services/history/FileSnapshotStore";
import { MutationHistory } from "../../../services/history/MutationHistory";
import { SecureSnapshotStore } from "../../../services/history/SecureSnapshotStore";
import { NileLogger } from "../../../services/NileLogger";
import { RollbackLatest } from "../../RollbackLatest";
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
      new RollbackLatest(
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
  ): RollbackLatestMutation {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "codex-rollback-latest" });
    return new RollbackLatestMutation(
      new RollbackLatest(
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
      ),
    );
  }

  constructor(
    private readonly rollbackLatest: RollbackLatest,
    private readonly ownedContext: AgentAdapterContextSession | null = null,
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
