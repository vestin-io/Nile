import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import type { SecureSnapshotStore } from "@nile/core/services/history";
import { NileLogger } from "@nile/core/services/NileLogger";
import type {
  AgentAdapter,
  ImportCurrentConnectionInput,
  RollbackLatestAgentResult,
} from "@nile/core/models/agent/Adapter";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { AgentOperationRuntime } from "@nile/core/runtime-local/AgentOperationRuntime";
import { ApplySelection } from "./ApplySelection";
import { GEMINI_HOME_RESOLVER } from "./Home";
import { LiveSetupDetector } from "./live-setup/Detector";
import { ImportCurrentConnection } from "./ImportCurrentConnection";
import { RollbackLatestMutation } from "./RollbackLatestMutation";
import { GEMINI_AGENT_ID } from "./types";

export type GeminiAgentAdapterOptions = {
  databasePath: string;
  geminiHome?: string;
  credentialStore: CredentialStore;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
  sharedContext?: AgentWorkspaceContext;
};

export class GeminiAgentAdapter implements AgentAdapter {
  readonly agentId = GEMINI_AGENT_ID;
  readonly rollbackSupport = "yes" as const;

  private readonly openApplyOperation: () => ApplySelection;
  private readonly openImportOperation: () => ImportCurrentConnection;
  private readonly openRollbackOperation: () => RollbackLatestMutation;
  private readonly openDetectOperation: () => LiveSetupDetector;

  constructor(options: GeminiAgentAdapterOptions) {
    const databasePath = options.databasePath;
    const geminiHome = GEMINI_HOME_RESOLVER.resolve(options.geminiHome ?? join(homedir(), ".gemini"));
    const credentialStore = options.credentialStore;
    const secureSnapshotStore = options.secureSnapshotStore;
    const logger = options.logger ?? NileLogger.silent().child({ module: "gemini-agent-adapter" });
    const runtime = new AgentOperationRuntime(databasePath, options.sharedContext);

    this.openApplyOperation = runtime.build(ApplySelection, {
      geminiHome,
      credentialStore,
      secureSnapshotStore,
      logger: logger.child({ scope: "apply-selection" }),
    });
    this.openImportOperation = runtime.build(ImportCurrentConnection, {
      geminiHome,
      credentialStore,
      logger: logger.child({ scope: "import-current-connection" }),
    });
    this.openRollbackOperation = runtime.build(RollbackLatestMutation, {
      geminiHome,
      credentialStore,
      secureSnapshotStore,
      logger: logger.child({ scope: "rollback-latest-mutation" }),
    });
    this.openDetectOperation = runtime.build(LiveSetupDetector, {
      geminiHome,
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

  async importCurrentConnection(input?: ImportCurrentConnectionInput) {
    return await AgentOperationRuntime.runAsync(
      this.openImportOperation,
      async (importer) => await importer.importCurrent(input),
    );
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
