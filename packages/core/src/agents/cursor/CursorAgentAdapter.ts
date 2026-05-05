import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { EnvironmentSource } from "../../services/EnvironmentSource";
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
import { CURSOR_AGENT_ID } from "./types";

export type CursorAgentAdapterOptions = {
  databasePath: string;
  cursorHome?: string;
  credentialStore: CredentialStore;
  environment?: EnvironmentSource;
  secureSnapshotStore?: import("../../services/history/SecureSnapshotStore").SecureSnapshotStore;
  logger?: NileLogger;
  sharedContext?: SharedAgentAdapterContext;
};

export class CursorAgentAdapter extends ManagedAgentAdapter {
  readonly agentId = CURSOR_AGENT_ID;
  readonly rollbackSupport = "yes" as const;

  private readonly openApplyOperation: () => ApplySelection;
  private readonly openImportOperation: () => ImportCurrentConnection;
  private readonly openRollbackOperation: () => RollbackLatestMutation;
  private readonly openDetectOperation: () => CurrentStateDetector;

  constructor(options: CursorAgentAdapterOptions) {
    super();
    const databasePath = options.databasePath;
    const cursorHome = options.cursorHome ?? join(homedir(), ".cursor");
    const credentialStore = options.credentialStore;
    const environment = options.environment ?? EnvironmentSource.from(process.env);
    const secureSnapshotStore = options.secureSnapshotStore;
    const logger = options.logger ?? NileLogger.silent().child({ module: "cursor-agent-adapter" });
    const sharedContext = options.sharedContext;

    this.openApplyOperation = () => sharedContext
      ? ApplySelection.fromContext(sharedContext, {
          cursorHome,
          credentialStore,
          secureSnapshotStore,
          logger: logger.child({ scope: "apply-selection" }),
        })
      : ApplySelection.open(databasePath, {
          cursorHome,
          credentialStore,
          secureSnapshotStore,
          logger: logger.child({ scope: "apply-selection" }),
        });
    this.openImportOperation = () => sharedContext
      ? ImportCurrentConnection.fromContext(sharedContext, {
          cursorHome,
          credentialStore,
          environment,
          logger: logger.child({ scope: "import-current-connection" }),
        })
      : ImportCurrentConnection.open(databasePath, {
          cursorHome,
          credentialStore,
          environment,
          logger: logger.child({ scope: "import-current-connection" }),
        });
    this.openRollbackOperation = () => sharedContext
      ? RollbackLatestMutation.fromContext(sharedContext, {
          cursorHome,
          credentialStore,
          secureSnapshotStore,
          logger: logger.child({ scope: "rollback-latest-mutation" }),
        })
      : RollbackLatestMutation.open(databasePath, {
          cursorHome,
          credentialStore,
          secureSnapshotStore,
          logger: logger.child({ scope: "rollback-latest-mutation" }),
        });
    this.openDetectOperation = () => sharedContext
      ? CurrentStateDetector.fromContext(sharedContext, {
          cursorHome,
          credentialStore,
          environment,
          logger: logger.child({ scope: "current-state-detector" }),
        })
      : CurrentStateDetector.open(databasePath, {
          cursorHome,
          credentialStore,
          environment,
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
      return {
        agentId: this.agentId,
        ...rollback.rollback(),
      };
    } finally {
      rollback.close();
    }
  }

  protected openDetector(): CurrentStateDetector {
    return this.openDetectOperation();
  }
}
