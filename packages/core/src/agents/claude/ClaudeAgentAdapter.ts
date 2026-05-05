import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
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
import { CLAUDE_AGENT_ID } from "./types";

export type ClaudeAgentAdapterOptions = {
  databasePath: string;
  claudeHome?: string;
  credentialStore: CredentialStore;
  secureSnapshotStore?: import("../../services/history/SecureSnapshotStore").SecureSnapshotStore;
  logger?: NileLogger;
  sharedContext?: SharedAgentAdapterContext;
};

export class ClaudeAgentAdapter extends ManagedAgentAdapter {
  readonly agentId = CLAUDE_AGENT_ID;
  readonly rollbackSupport = "yes" as const;

  private readonly openApplyOperation: () => ApplySelection;
  private readonly openImportOperation: () => ImportCurrentConnection;
  private readonly openRollbackOperation: () => RollbackLatestMutation;
  private readonly openDetectOperation: () => CurrentStateDetector;

  constructor(options: ClaudeAgentAdapterOptions) {
    super();
    const databasePath = options.databasePath;
    const claudeHome = options.claudeHome ?? join(homedir(), ".claude");
    const credentialStore = options.credentialStore;
    const secureSnapshotStore = options.secureSnapshotStore;
    const logger = options.logger ?? NileLogger.silent().child({ module: "claude-agent-adapter" });
    const sharedContext = options.sharedContext;

    this.openApplyOperation = () => sharedContext
      ? ApplySelection.fromContext(sharedContext, {
          claudeHome,
          credentialStore,
          secureSnapshotStore,
          logger: logger.child({ scope: "apply-selection" }),
        })
      : ApplySelection.open(databasePath, {
          claudeHome,
          credentialStore,
          secureSnapshotStore,
          logger: logger.child({ scope: "apply-selection" }),
        });
    this.openImportOperation = () => sharedContext
      ? ImportCurrentConnection.fromContext(sharedContext, {
          claudeHome,
          credentialStore,
          logger: logger.child({ scope: "import-current-connection" }),
        })
      : ImportCurrentConnection.open(databasePath, {
          claudeHome,
          credentialStore,
          logger: logger.child({ scope: "import-current-connection" }),
        });
    this.openRollbackOperation = () => sharedContext
      ? RollbackLatestMutation.fromContext(sharedContext, {
          claudeHome,
          credentialStore,
          secureSnapshotStore,
          logger: logger.child({ scope: "rollback-latest-mutation" }),
        })
      : RollbackLatestMutation.open(databasePath, {
          claudeHome,
          credentialStore,
          secureSnapshotStore,
          logger: logger.child({ scope: "rollback-latest-mutation" }),
        });
    this.openDetectOperation = () => sharedContext
      ? CurrentStateDetector.fromContext(sharedContext, {
          claudeHome,
          credentialStore,
          logger: logger.child({ scope: "current-state-detector" }),
        })
      : CurrentStateDetector.open(databasePath, {
          claudeHome,
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
