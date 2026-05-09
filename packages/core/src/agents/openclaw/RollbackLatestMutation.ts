import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { FileSnapshotStore } from "../../services/history/FileSnapshotStore";
import { MutationHistory } from "../../services/history/MutationHistory";
import { SecureSnapshotStore } from "../../services/history/SecureSnapshotStore";
import { NileLogger } from "../../services/NileLogger";
import { RollbackLatest } from "../RollbackLatest";
import {
  AgentWorkspaceSession,
} from "../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../runtime-local/AgentWorkspaceContext";
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
      codexHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): RollbackLatestMutation {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-rollback-latest" });
    const context = AgentWorkspaceSession.open(databasePath, options.credentialStore);
    return new RollbackLatestMutation(
      new RollbackLatest(
        new MutationHistory(
          context.workspaceState.database,
          new FileSnapshotStore(join(dirname(databasePath), "history")),
          options?.secureSnapshotStore ?? new SecureSnapshotStore(),
          logger.child({ scope: "mutation-history" }),
        ),
        context.agentSelection,
        CurrentStateDetector.fromContext(context.sharedContext, {
          openclawHome: options?.openclawHome ?? join(homedir(), ".openclaw"),
          codexHome: options?.codexHome ?? join(homedir(), ".codex"),
          credentialStore: options.credentialStore,
          logger: logger.child({ scope: "openclaw-current-state-detector" }),
        }),
        logger,
      ),
      context,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      openclawHome?: string;
      codexHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): RollbackLatestMutation {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-rollback-latest" });
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
          openclawHome: options?.openclawHome ?? join(homedir(), ".openclaw"),
          codexHome: options?.codexHome ?? join(homedir(), ".codex"),
          credentialStore: options.credentialStore,
          logger: logger.child({ scope: "openclaw-current-state-detector" }),
        }),
        logger,
      ),
    );
  }

  constructor(
    private readonly rollbackLatest: RollbackLatest,
    private readonly ownedContext: AgentWorkspaceSession | null = null,
  ) {}

  rollback(): RollbackLatestResult {
    return this.rollbackLatest.execute({
      agentId: OPENCLAW_AGENT_ID,
      startEvent: "openclaw.rollback.start",
      successEvent: "openclaw.rollback.success",
    });
  }

  close(): void {
    this.rollbackLatest.close();
    this.ownedContext?.close();
  }
}
