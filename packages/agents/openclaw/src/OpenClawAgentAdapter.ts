import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { AgentAdapter, RollbackLatestAgentResult } from "@nile/core/models/agent/Adapter";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { AgentOperationRuntime } from "@nile/core/runtime-local/AgentOperationRuntime";
import { ApplySelection } from "./ApplySelection";
import { LiveSetupDetector } from "./live-setup/Detector";
import { ImportCurrentConnection } from "./ImportCurrentConnection";
import { RollbackLatestMutation } from "./RollbackLatestMutation";
import { OPENCLAW_AGENT_ID } from "./types";

export type OpenClawAgentAdapterOptions = {
  databasePath: string;
  openclawHome?: string;
  credentialStore: CredentialStore;
  environment?: EnvironmentSource;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
  sharedContext?: AgentWorkspaceContext;
};

export class OpenClawAgentAdapter implements AgentAdapter {
  readonly agentId = OPENCLAW_AGENT_ID;
  readonly rollbackSupport = "yes" as const;

  private readonly openApplyOperation: () => ApplySelection;
  private readonly openImportOperation: () => ImportCurrentConnection;
  private readonly openRollbackOperation: () => RollbackLatestMutation;
  private readonly openDetectOperation: () => LiveSetupDetector;

  constructor(options: OpenClawAgentAdapterOptions) {
    const databasePath = options.databasePath;
    const openclawHome = options.openclawHome ?? join(homedir(), ".openclaw");
    const credentialStore = options.credentialStore;
    const environment = options.environment ?? EnvironmentSource.from(process.env);
    const secureSnapshotStore = options.secureSnapshotStore;
    const logger = options.logger ?? NileLogger.silent().child({ module: "openclaw-agent-adapter" });
    const runtime = new AgentOperationRuntime(databasePath, options.sharedContext);

    this.openApplyOperation = runtime.build(ApplySelection, {
      openclawHome,
      credentialStore,
      environment,
      secureSnapshotStore,
      logger: logger.child({ scope: "apply-selection" }),
    });
    this.openImportOperation = runtime.build(ImportCurrentConnection, {
      openclawHome,
      credentialStore,
      logger: logger.child({ scope: "import-current-connection" }),
    });
    this.openRollbackOperation = runtime.build(RollbackLatestMutation, {
      openclawHome,
      credentialStore,
      secureSnapshotStore,
      logger: logger.child({ scope: "rollback-latest-mutation" }),
    });
    this.openDetectOperation = runtime.build(LiveSetupDetector, {
      openclawHome,
      credentialStore,
      logger: logger.child({ scope: "live-setup-detector" }),
    });
  }

  detectAgentSelection() {
    return AgentOperationRuntime.run(this.openDetectOperation, (detector) => detector.detectAgentSelection());
  }

  applySelection(connectionId: string) {
    return AgentOperationRuntime.run(this.openApplyOperation, (applySelection) => applySelection.apply(connectionId));
  }

  async importCurrentConnection() {
    return await AgentOperationRuntime.runAsync(this.openImportOperation, async (importer) => await importer.importCurrent());
  }

  rollbackLatestMutation(): RollbackLatestAgentResult {
    return AgentOperationRuntime.run(this.openRollbackOperation, (rollback) => {
      const result = rollback.rollback();
      return {
        agentId: this.agentId,
        rolledBackMutationId: result.rolledBackMutationId,
        rollbackMutationId: result.rollbackMutationId,
      };
    });
  }
}
