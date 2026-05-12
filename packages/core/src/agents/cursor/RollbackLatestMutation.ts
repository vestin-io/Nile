import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { FileSnapshotStore } from "../../services/history/FileSnapshotStore";
import { MutationHistory, MutationHistoryError } from "../../services/history/MutationHistory";
import { SecureSnapshotStore } from "../../services/history/SecureSnapshotStore";
import { NileLogger } from "../../services/NileLogger";
import {
  AgentWorkspaceSession,
} from "../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../runtime-local/AgentWorkspaceContext";
import { CURSOR_AGENT_ID } from "./types";
import { CursorHistoryTargets } from "./HistoryTargets";
import { LiveSetupDetector } from "./live-setup/Detector";
import { CursorConfigStore } from "./stores/CursorConfigStore";
import { CursorCredentialStore } from "./stores/CursorCredentialStore";

export type RollbackLatestResult = {
  rolledBackMutationId: string;
  rollbackMutationId: string;
};

export class RollbackLatestMutation {
  static open(
    databasePath: string,
    options: {
      cursorHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): RollbackLatestMutation {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "cursor-rollback-latest" });
    const context = AgentWorkspaceSession.open(databasePath, options.credentialStore);
    const cursorHome = options?.cursorHome ?? join(homedir(), ".cursor");
    return new RollbackLatestMutation(
      new MutationHistory(
        context.workspaceState.database,
        new FileSnapshotStore(join(dirname(databasePath), "history")),
        options?.secureSnapshotStore ?? new SecureSnapshotStore(),
        logger.child({ scope: "mutation-history" }),
      ),
      new FileSnapshotStore(join(dirname(databasePath), "history")),
      options?.secureSnapshotStore ?? new SecureSnapshotStore(),
      context.agentSelection,
      LiveSetupDetector.fromContext(context.sharedContext, {
        cursorHome,
        credentialStore: options.credentialStore,
        logger: logger.child({ scope: "cursor-live-setup-detector" }),
      }),
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
      logger,
      context,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      cursorHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): RollbackLatestMutation {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "cursor-rollback-latest" });
    const cursorHome = options?.cursorHome ?? join(homedir(), ".cursor");
    return new RollbackLatestMutation(
      new MutationHistory(
        context.database,
        new FileSnapshotStore(join(dirname(context.databasePath), "history")),
        options?.secureSnapshotStore ?? new SecureSnapshotStore(),
        logger.child({ scope: "mutation-history" }),
      ),
      new FileSnapshotStore(join(dirname(context.databasePath), "history")),
      options?.secureSnapshotStore ?? new SecureSnapshotStore(),
      context.agentSelection,
      LiveSetupDetector.fromContext(context, {
        cursorHome,
        credentialStore: options.credentialStore,
        logger: logger.child({ scope: "cursor-live-setup-detector" }),
      }),
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
      logger,
    );
  }

  constructor(
    private readonly mutationHistory: MutationHistory,
    private readonly fileSnapshots: FileSnapshotStore,
    private readonly secureSnapshots: SecureSnapshotStore,
    private readonly agentSelection: AgentWorkspaceContext["agentSelection"],
    private readonly currentStateDetector: LiveSetupDetector,
    private readonly configStore: CursorConfigStore,
    private readonly credentialStore: CursorCredentialStore,
    private readonly logger: NileLogger,
    private readonly ownedContext: AgentWorkspaceSession | null = null,
  ) {}

  rollback(): RollbackLatestResult {
    this.logger.info("cursor.rollback.start", {});
    const appliedMutation = this.mutationHistory.findLatestRollbackCandidate(CURSOR_AGENT_ID);
    if (!appliedMutation) {
      throw new MutationHistoryError(`No applied Nile mutation is available for rollback for agent ${CURSOR_AGENT_ID}`);
    }

    const currentCredentialSnapshot = this.credentialStore.snapshot();
    const rollbackEntry = this.mutationHistory.start({
      agentId: CURSOR_AGENT_ID,
      type: "rollback_latest",
      connectionId: appliedMutation.connectionId,
      connectionLabel: appliedMutation.connectionLabel,
      endpointLabel: appliedMutation.endpointLabel,
      accessLabel: appliedMutation.accessLabel,
      rollbackOfMutationId: appliedMutation.id,
      files: [
        {
          path: this.configStore.configPath,
          content: this.configStore.snapshot(),
          existedBefore: this.configStore.snapshot() !== null,
        },
        ...CursorHistoryTargets.toTrackedEntries(currentCredentialSnapshot),
      ],
    });

    try {
      this.assertNoDrift(appliedMutation.files, currentCredentialSnapshot);
      this.restoreAppliedMutation(appliedMutation.files);
      this.mutationHistory.markApplied(rollbackEntry.id, [
        { path: this.configStore.configPath, content: this.configStore.snapshot() },
        ...CursorHistoryTargets.toTrackedEntries(this.credentialStore.snapshot()).map((entry) => ({
          path: entry.path,
          content: entry.content,
        })),
      ]);
      const rollbackResult = this.mutationHistory.findLatestRollbackCandidate(CURSOR_AGENT_ID);
      this.agentSelection.clear(CURSOR_AGENT_ID);
      this.currentStateDetector.reconcileAgentSelection();
      this.logger.info("cursor.rollback.success", {
        rollbackMutationId: rollbackEntry.id,
        rolledBackMutationId: appliedMutation.id,
      });
      return {
        rolledBackMutationId: appliedMutation.id,
        rollbackMutationId: rollbackEntry.id,
      };
    } catch (error) {
      try {
        this.mutationHistory.markFailed(rollbackEntry.id, error instanceof Error ? error.message : String(error));
      } catch (historyError) {
        this.logger.error("cursor.rollback.history_mark_failed", historyError, {
          rollbackMutationId: rollbackEntry.id,
        });
      }
      throw error;
    }
  }

  close(): void {
    this.mutationHistory.close();
    this.currentStateDetector.close();
    this.ownedContext?.close();
  }

  private assertNoDrift(
    files: ReturnType<MutationHistory["list"]>[number]["files"],
    currentCredentialSnapshot: ReturnType<CursorCredentialStore["snapshot"]>,
  ): void {
    const currentCredentialEntries = CursorHistoryTargets.toTrackedEntries(currentCredentialSnapshot);

    for (const file of files) {
      const currentChecksum = CursorHistoryTargets.isTrackedCredentialPath(file.path)
        ? this.fileSnapshots.checksum(
            currentCredentialEntries.find((entry) => entry.path === file.path)?.content ?? null,
          )
        : this.fileSnapshots.readCurrentChecksum(file.path);
      if (currentChecksum !== file.afterChecksum) {
        throw new MutationHistoryError(
          `Cannot safely roll back ${CURSOR_AGENT_ID}: live file drift detected for ${file.path}`,
        );
      }
    }
  }

  private restoreAppliedMutation(files: ReturnType<MutationHistory["list"]>[number]["files"]): void {
    const credentialSnapshot = CursorHistoryTargets.fromTrackedValues(
      files
        .filter((file) => CursorHistoryTargets.isTrackedCredentialPath(file.path))
        .map((file) => ({
          path: file.path,
          content: file.existedBefore ? this.secureSnapshots.readSnapshot(file.beforeSnapshotRef) : null,
        })),
    );

    for (const file of files) {
      if (CursorHistoryTargets.isTrackedCredentialPath(file.path)) {
        continue;
      }
      if (file.beforeSnapshotKind === "secure") {
        this.secureSnapshots.restoreSnapshot(file.beforeSnapshotRef, file.path, file.existedBefore);
      } else {
        this.fileSnapshots.restoreSnapshot(file.beforeSnapshotRef, file.path, file.existedBefore);
      }
    }

    this.credentialStore.restore(credentialSnapshot);
  }
}
