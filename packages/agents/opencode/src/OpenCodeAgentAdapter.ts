import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { NileLogger } from "@nile/core/services/NileLogger";
import type {
  AgentAdapter,
  ImportCurrentConnectionInput,
  RollbackLatestAgentResult,
} from "@nile/core/models/agent/Adapter";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { AgentOperationRuntime } from "@nile/core/runtime-local/AgentOperationRuntime";
import { ApplySelection } from "./ApplySelection";
import { LiveSetupDetector } from "./live-setup/Detector";
import { ImportCurrentConnection } from "./ImportCurrentConnection";
import { RollbackLatestMutation } from "./RollbackLatestMutation";
import { OPENCODE_AGENT_ID } from "./types";

export type OpenCodeAgentAdapterOptions = {
  databasePath: string;
  opencodeHome?: string;
  opencodeDataHome?: string;
  credentialStore: CredentialStore;
  environment?: EnvironmentSource;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
  sharedContext?: AgentWorkspaceContext;
};

export class OpenCodeAgentAdapter implements AgentAdapter {
  readonly agentId = OPENCODE_AGENT_ID;
  readonly rollbackSupport = "yes" as const;

  private readonly openApplyOperation: () => ApplySelection;
  private readonly openImportOperation: () => ImportCurrentConnection;
  private readonly openRollbackOperation: () => RollbackLatestMutation;
  private readonly openDetectOperation: () => LiveSetupDetector;

  constructor(options: OpenCodeAgentAdapterOptions) {
    const databasePath = options.databasePath;
    const opencodeHome = options.opencodeHome ?? join(homedir(), ".config", "opencode");
    const opencodeDataHome = options.opencodeDataHome ?? join(homedir(), ".local", "share", "opencode");
    const credentialStore = options.credentialStore;
    const environment = options.environment ?? EnvironmentSource.from(process.env);
    const secureSnapshotStore = options.secureSnapshotStore;
    const logger = options.logger ?? NileLogger.silent().child({ module: "opencode-agent-adapter" });
    const runtime = new AgentOperationRuntime(databasePath, options.sharedContext);

    this.openApplyOperation = runtime.build(ApplySelection, {
      opencodeHome,
      opencodeDataHome,
      credentialStore,
      environment,
      secureSnapshotStore,
      logger: logger.child({ scope: "apply-selection" }),
    });
    this.openImportOperation = runtime.build(ImportCurrentConnection, {
      opencodeHome,
      opencodeDataHome,
      credentialStore,
      logger: logger.child({ scope: "import-current-connection" }),
    });
    this.openRollbackOperation = runtime.build(RollbackLatestMutation, {
      opencodeHome,
      opencodeDataHome,
      credentialStore,
      secureSnapshotStore,
      logger: logger.child({ scope: "rollback-latest-mutation" }),
    });
    this.openDetectOperation = runtime.build(LiveSetupDetector, {
      opencodeHome,
      opencodeDataHome,
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
      const result = rollback.rollback();
      return {
        agentId: this.agentId,
        rolledBackMutationId: result.rolledBackMutationId,
        rollbackMutationId: result.rollbackMutationId,
      };
    });
  }
}
