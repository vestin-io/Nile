import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { AgentAdapter, RollbackLatestAgentResult } from "@nile/core/models/agent/Adapter";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { AgentOperationRuntime } from "@nile/core/runtime-local/AgentOperationRuntime";
import { ApplySelection } from "./ApplySelection";
import { LiveSetupDetector } from "./live-setup/Detector";
import { ImportCurrentConnection } from "./ImportCurrentConnection";
import { RollbackLatestMutation } from "./RollbackLatestMutation";
import { CURSOR_AGENT_ID } from "./types";

export type CursorAgentAdapterOptions = {
  databasePath: string;
  cursorHome?: string;
  credentialStore: CredentialStore;
  environment?: EnvironmentSource;
  secureSnapshotStore?: import("@nile/core/services/history").SecureSnapshotStore;
  logger?: NileLogger;
  sharedContext?: AgentWorkspaceContext;
};

export class CursorAgentAdapter implements AgentAdapter {
  readonly agentId = CURSOR_AGENT_ID;
  readonly rollbackSupport = "yes" as const;

  private readonly openApplyOperation: () => ApplySelection;
  private readonly openImportOperation: () => ImportCurrentConnection;
  private readonly openRollbackOperation: () => RollbackLatestMutation;
  private readonly openDetectOperation: () => LiveSetupDetector;

  constructor(options: CursorAgentAdapterOptions) {
    const databasePath = options.databasePath;
    const cursorHome = options.cursorHome ?? join(homedir(), ".cursor");
    const credentialStore = options.credentialStore;
    const environment = options.environment ?? EnvironmentSource.from(process.env);
    const secureSnapshotStore = options.secureSnapshotStore;
    const logger = options.logger ?? NileLogger.silent().child({ module: "cursor-agent-adapter" });
    const runtime = new AgentOperationRuntime(databasePath, options.sharedContext);

    this.openApplyOperation = runtime.build(ApplySelection, {
      cursorHome,
      credentialStore,
      secureSnapshotStore,
      logger: logger.child({ scope: "apply-selection" }),
    });
    this.openImportOperation = runtime.build(ImportCurrentConnection, {
      cursorHome,
      credentialStore,
      environment,
      logger: logger.child({ scope: "import-current-connection" }),
    });
    this.openRollbackOperation = runtime.build(RollbackLatestMutation, {
      cursorHome,
      credentialStore,
      secureSnapshotStore,
      logger: logger.child({ scope: "rollback-latest-mutation" }),
    });
    this.openDetectOperation = runtime.build(LiveSetupDetector, {
      cursorHome,
      credentialStore,
      environment,
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
      return {
        agentId: this.agentId,
        ...rollback.rollback(),
      };
    });
  }
}
