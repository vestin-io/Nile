import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { EnvironmentSource } from "../../services/EnvironmentSource";
import { NileLogger } from "../../services/NileLogger";
import type { AgentAdapter, RollbackLatestAgentResult } from "../../models/agent";
import type { AgentWorkspaceContext } from "../../runtime-local/AgentWorkspaceContext";
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
  secureSnapshotStore?: import("../../services/history/SecureSnapshotStore").SecureSnapshotStore;
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
      ? LiveSetupDetector.fromContext(sharedContext, {
          cursorHome,
          credentialStore,
          environment,
          logger: logger.child({ scope: "live-setup-detector" }),
        })
      : LiveSetupDetector.open(databasePath, {
          cursorHome,
          credentialStore,
          environment,
          logger: logger.child({ scope: "live-setup-detector" }),
        });
  }

  detectAgentSelection() {
    const detector = this.openDetectOperation();
    try {
      return detector.detectAgentSelection();
    } finally {
      detector.close();
    }
  }

  applySelection(connectionId: string) {
    const applySelection = this.openApplyOperation();
    try {
      return applySelection.apply(connectionId);
    } finally {
      applySelection.close();
    }
  }

  async importCurrentConnection() {
    const importer = this.openImportOperation();
    try {
      return await importer.importCurrent();
    } finally {
      importer.close();
    }
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
}
