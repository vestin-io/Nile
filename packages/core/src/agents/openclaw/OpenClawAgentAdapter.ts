import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { EnvironmentSource } from "../../services/EnvironmentSource";
import { SecureSnapshotStore } from "../../services/history/SecureSnapshotStore";
import { NileLogger } from "../../services/NileLogger";
import type {
  RollbackLatestAgentResult,
} from "../../runtime-local/AgentAdapterTypes";
import { ManagedAgentAdapter } from "../../runtime-local/ManagedAgentAdapter";
import type { SharedAgentAdapterContext } from "../../runtime-local/AgentAdapterContext";
import { ApplySelection } from "./ApplySelection";
import { CurrentStateDetector } from "./current-state/Detector";
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
  sharedContext?: SharedAgentAdapterContext;
};

export class OpenClawAgentAdapter extends ManagedAgentAdapter {
  readonly agentId = OPENCLAW_AGENT_ID;
  readonly rollbackSupport = "yes" as const;

  private readonly openApplyOperation: () => ApplySelection;
  private readonly openImportOperation: () => ImportCurrentConnection;
  private readonly openRollbackOperation: () => RollbackLatestMutation;
  private readonly openDetectOperation: () => CurrentStateDetector;

  constructor(options: OpenClawAgentAdapterOptions) {
    super();
    const databasePath = options.databasePath;
    const openclawHome = options.openclawHome ?? join(homedir(), ".openclaw");
    const credentialStore = options.credentialStore;
    const environment = options.environment ?? EnvironmentSource.from(process.env);
    const secureSnapshotStore = options.secureSnapshotStore;
    const logger = options.logger ?? NileLogger.silent().child({ module: "openclaw-agent-adapter" });
    const sharedContext = options.sharedContext;

    this.openApplyOperation = () => sharedContext
      ? ApplySelection.fromContext(sharedContext, {
          openclawHome,
          credentialStore,
          environment,
          secureSnapshotStore,
          logger: logger.child({ scope: "apply-selection" }),
        })
      : ApplySelection.open(databasePath, {
          openclawHome,
          credentialStore,
          environment,
          secureSnapshotStore,
          logger: logger.child({ scope: "apply-selection" }),
        });
    this.openImportOperation = () => sharedContext
      ? ImportCurrentConnection.fromContext(sharedContext, {
          openclawHome,
          credentialStore,
          logger: logger.child({ scope: "import-current-connection" }),
        })
      : ImportCurrentConnection.open(databasePath, {
          openclawHome,
          credentialStore,
          logger: logger.child({ scope: "import-current-connection" }),
        });
    this.openRollbackOperation = () => sharedContext
      ? RollbackLatestMutation.fromContext(sharedContext, {
          openclawHome,
          credentialStore,
          secureSnapshotStore,
          logger: logger.child({ scope: "rollback-latest-mutation" }),
        })
      : RollbackLatestMutation.open(databasePath, {
          openclawHome,
          credentialStore,
          secureSnapshotStore,
          logger: logger.child({ scope: "rollback-latest-mutation" }),
        });
    this.openDetectOperation = () => sharedContext
      ? CurrentStateDetector.fromContext(sharedContext, {
          openclawHome,
          credentialStore,
          logger: logger.child({ scope: "current-state-detector" }),
        })
      : CurrentStateDetector.open(databasePath, {
          openclawHome,
          credentialStore,
          logger: logger.child({ scope: "current-state-detector" }),
        });
  }

  protected openApplySelection(): ApplySelection {
    return this.openApplyOperation();
  }

  protected openImporter(): ImportCurrentConnection {
    return this.openImportOperation();
  }

  rollbackLatestMutation(): RollbackLatestAgentResult {
    const rollback = this.openRollbackOperation();

    try {
      const result = rollback.rollback();
      return {
        agentId: this.agentId,
        rolledBackMutationId: result.rolledBackMutationId,
        rollbackMutationId: result.rollbackMutationId,
      };
    } finally {
      rollback.close();
    }
  }

  protected openDetector(): CurrentStateDetector {
    return this.openDetectOperation();
  }
}
