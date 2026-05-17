import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { AgentAdapter, RollbackLatestAgentResult } from "@nile/core/models/agent/Adapter";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { AgentOperationRuntime } from "@nile/core/runtime-local/AgentOperationRuntime";
import { ApplySelection } from "./ApplySelection";
import { LiveSetupDetector } from "./live-setup/Detector";
import { ImportCurrentConnection } from "./ImportCurrentConnection";
import { RollbackLatestMutation } from "./RollbackLatestMutation";
import { CLAUDE_AGENT_ID } from "./types";

export type ClaudeAgentAdapterOptions = {
  databasePath: string;
  claudeHome?: string;
  credentialStore: CredentialStore;
  secureSnapshotStore?: import("@nile/core/services/history").SecureSnapshotStore;
  logger?: NileLogger;
  sharedContext?: AgentWorkspaceContext;
};

export class ClaudeAgentAdapter implements AgentAdapter {
  readonly agentId = CLAUDE_AGENT_ID;
  readonly rollbackSupport = "yes" as const;

  private readonly openApplyOperation: () => ApplySelection;
  private readonly openImportOperation: () => ImportCurrentConnection;
  private readonly openRollbackOperation: () => RollbackLatestMutation;
  private readonly openDetectOperation: () => LiveSetupDetector;

  constructor(options: ClaudeAgentAdapterOptions) {
    const databasePath = options.databasePath;
    const claudeHome = options.claudeHome ?? join(homedir(), ".claude");
    const credentialStore = options.credentialStore;
    const secureSnapshotStore = options.secureSnapshotStore;
    const logger = options.logger ?? NileLogger.silent().child({ module: "claude-agent-adapter" });
    const runtime = new AgentOperationRuntime(databasePath, options.sharedContext);

    this.openApplyOperation = runtime.build(ApplySelection, {
      claudeHome,
      credentialStore,
      secureSnapshotStore,
      logger: logger.child({ scope: "apply-selection" }),
    });
    this.openImportOperation = runtime.build(ImportCurrentConnection, {
      claudeHome,
      credentialStore,
      logger: logger.child({ scope: "import-current-connection" }),
    });
    this.openRollbackOperation = runtime.build(RollbackLatestMutation, {
      claudeHome,
      credentialStore,
      secureSnapshotStore,
      logger: logger.child({ scope: "rollback-latest-mutation" }),
    });
    this.openDetectOperation = runtime.build(LiveSetupDetector, {
      claudeHome,
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
      return {
        agentId: this.agentId,
        ...rollback.rollback(),
      };
    });
  }
}
