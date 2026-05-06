import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { NileLogger } from "../../services/NileLogger";
import type { AgentAdapter, RollbackLatestAgentResult } from "../../models/agent";
import type { AgentWorkspaceContext } from "../../runtime-local/AgentWorkspaceContext";
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
  sharedContext?: AgentWorkspaceContext;
};

export class ClaudeAgentAdapter implements AgentAdapter {
  readonly agentId = CLAUDE_AGENT_ID;
  readonly rollbackSupport = "yes" as const;

  private readonly openApplyOperation: () => ApplySelection;
  private readonly openImportOperation: () => ImportCurrentConnection;
  private readonly openRollbackOperation: () => RollbackLatestMutation;
  private readonly openDetectOperation: () => CurrentStateDetector;

  constructor(options: ClaudeAgentAdapterOptions) {
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

  importCurrentConnection() {
    const importer = this.openImportOperation();
    try {
      return importer.importCurrent();
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
