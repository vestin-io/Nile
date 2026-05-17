import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { FileSnapshotStore } from "@nile/core/services/history";
import { MutationHistory, MutationHistoryError } from "@nile/core/services/history";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { NileLogger } from "@nile/core/services/NileLogger";
import { AgentWorkspaceBinding } from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { GeminiAccountsStore } from "./AccountsStore";
import { GeminiCredentialBackend } from "./Backend";
import { GEMINI_AGENT_ID } from "./types";
import { GeminiHistoryTargets } from "./HistoryTargets";
import { GeminiSettingsStore } from "./SettingsStore";
import { GeminiSessionStores } from "./Stores";
import { LiveSetupDetector } from "./live-setup/Detector";

export type RollbackLatestResult = {
  rolledBackMutationId: string;
  rollbackMutationId: string;
};

export class RollbackLatestMutation {
  static open(
    databasePath: string,
    options: {
      geminiHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): RollbackLatestMutation {
    const logger = options.logger ?? NileLogger.silent().child({ module: "gemini-rollback-latest" });
    const binding = AgentWorkspaceBinding.open(databasePath, options.credentialStore);
    const geminiHome = options.geminiHome ?? join(homedir(), ".gemini");
    const stores = GeminiSessionStores.open(geminiHome);
    return new RollbackLatestMutation(
      binding.createMutationHistory(
        options.secureSnapshotStore,
        logger.child({ scope: "mutation-history" }),
      ),
      new FileSnapshotStore(join(dirname(binding.context.databasePath), "history")),
      options.secureSnapshotStore ?? new SecureSnapshotStore(),
      binding.context.agentSelection,
      LiveSetupDetector.fromContext(binding.context, {
        geminiHome,
        credentialStore: options.credentialStore,
        logger: logger.child({ scope: "gemini-live-setup-detector" }),
      }),
      stores.backend,
      stores.accounts,
      stores.settings,
      logger,
      binding,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      geminiHome?: string;
      credentialStore: CredentialStore;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): RollbackLatestMutation {
    const logger = options.logger ?? NileLogger.silent().child({ module: "gemini-rollback-latest" });
    const geminiHome = options.geminiHome ?? join(homedir(), ".gemini");
    const stores = GeminiSessionStores.open(geminiHome);
    const binding = AgentWorkspaceBinding.fromContext(context);
    return new RollbackLatestMutation(
      binding.createMutationHistory(
        options.secureSnapshotStore,
        logger.child({ scope: "mutation-history" }),
      ),
      new FileSnapshotStore(join(dirname(binding.context.databasePath), "history")),
      options.secureSnapshotStore ?? new SecureSnapshotStore(),
      binding.context.agentSelection,
      LiveSetupDetector.fromContext(binding.context, {
        geminiHome,
        credentialStore: options.credentialStore,
        logger: logger.child({ scope: "gemini-live-setup-detector" }),
      }),
      stores.backend,
      stores.accounts,
      stores.settings,
      logger,
    );
  }

  constructor(
    private readonly mutationHistory: MutationHistory,
    private readonly fileSnapshots: FileSnapshotStore,
    private readonly secureSnapshots: SecureSnapshotStore,
    private readonly agentSelection: AgentWorkspaceContext["agentSelection"],
    private readonly currentStateDetector: LiveSetupDetector,
    private readonly backend: GeminiCredentialBackend,
    private readonly accountsStore: GeminiAccountsStore,
    private readonly settingsStore: GeminiSettingsStore,
    private readonly logger: NileLogger,
    private readonly ownedContext: { close(): void } | null = null,
  ) {}

  rollback(): RollbackLatestResult {
    this.logger.info("gemini.rollback.start", {});
    const appliedMutation = this.mutationHistory.findLatestRollbackCandidate(GEMINI_AGENT_ID);
    if (!appliedMutation) {
      throw new MutationHistoryError(`No applied Nile mutation is available for rollback for agent ${GEMINI_AGENT_ID}`);
    }

    const backendSnapshot = this.backend.snapshot();
    const accountsSnapshot = this.accountsStore.snapshot();
    const settingsSnapshot = this.settingsStore.snapshot();
    const rollbackEntry = this.mutationHistory.start({
      agentId: GEMINI_AGENT_ID,
      type: "rollback_latest",
      connectionId: appliedMutation.connectionId,
      connectionLabel: appliedMutation.connectionLabel,
      endpointLabel: appliedMutation.endpointLabel,
      accessLabel: appliedMutation.accessLabel,
      rollbackOfMutationId: appliedMutation.id,
      files: [
        GeminiHistoryTargets.toTrackedEntry(backendSnapshot),
        {
          path: this.accountsStore.accountsPath,
          content: accountsSnapshot,
          existedBefore: accountsSnapshot !== null,
        },
        {
          path: this.settingsStore.settingsPath,
          content: settingsSnapshot,
          existedBefore: settingsSnapshot !== null,
        },
      ],
    });

    try {
      this.assertNoDrift(appliedMutation.files, backendSnapshot);
      this.restoreAppliedMutation(appliedMutation.files);
      this.mutationHistory.markApplied(rollbackEntry.id, [
        {
          path: GeminiHistoryTargets.toTrackedEntry(this.backend.snapshot()).path,
          content: GeminiHistoryTargets.toTrackedEntry(this.backend.snapshot()).content,
        },
        { path: this.accountsStore.accountsPath, content: this.accountsStore.snapshot() },
        { path: this.settingsStore.settingsPath, content: this.settingsStore.snapshot() },
      ]);
      this.agentSelection.clear(GEMINI_AGENT_ID);
      this.currentStateDetector.reconcileAgentSelection();
      this.logger.info("gemini.rollback.success", {
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
        this.logger.error("gemini.rollback.history_mark_failed", historyError, {
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
    backendSnapshot: ReturnType<GeminiCredentialBackend["snapshot"]>,
  ): void {
    const backendEntry = GeminiHistoryTargets.toTrackedEntry(backendSnapshot);
    for (const file of files) {
      const currentChecksum = GeminiHistoryTargets.isTrackedPath(file.path)
        ? this.fileSnapshots.checksum(backendEntry.content)
        : this.fileSnapshots.readCurrentChecksum(file.path);
      if (currentChecksum !== file.afterChecksum) {
        throw new MutationHistoryError(
          `Cannot safely roll back ${GEMINI_AGENT_ID}: live file drift detected for ${file.path}`,
        );
      }
    }
  }

  private restoreAppliedMutation(files: ReturnType<MutationHistory["list"]>[number]["files"]): void {
    for (const file of files) {
      if (GeminiHistoryTargets.isTrackedPath(file.path)) {
        const content = file.existedBefore
          ? this.secureSnapshots.readSnapshot(file.beforeSnapshotRef)
          : null;
        this.backend.restoreSnapshot(GeminiHistoryTargets.fromTrackedContent(content));
        continue;
      }

      if (file.beforeSnapshotKind === "secure") {
        this.secureSnapshots.restoreSnapshot(file.beforeSnapshotRef, file.path, file.existedBefore);
      } else {
        this.fileSnapshots.restoreSnapshot(file.beforeSnapshotRef, file.path, file.existedBefore);
      }
    }
  }
}
