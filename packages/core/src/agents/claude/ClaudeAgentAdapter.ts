import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { NileLogger } from "../../services/NileLogger";
import type {
  RollbackLatestAgentResult,
  AgentAdapterCapabilities,
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

  readonly capabilities: AgentAdapterCapabilities = {
    detect: "yes",
    apply: "yes",
    import: "yes",
    history: "yes",
    rollback: "yes",
    desktopSupport: "partial",
  };

  private readonly databasePath: string;
  private readonly claudeHome: string;
  private readonly credentialStore: CredentialStore;
  private readonly secureSnapshotStore: ClaudeAgentAdapterOptions["secureSnapshotStore"];
  private readonly logger: NileLogger;
  private readonly sharedContext: SharedAgentAdapterContext | undefined;

  constructor(options: ClaudeAgentAdapterOptions) {
    super();
    this.databasePath = options.databasePath;
    this.claudeHome = options.claudeHome ?? join(homedir(), ".claude");
    this.credentialStore = options.credentialStore;
    this.secureSnapshotStore = options.secureSnapshotStore;
    this.logger = options.logger ?? NileLogger.silent().child({ module: "claude-agent-adapter" });
    this.sharedContext = options.sharedContext;
  }

  protected openApplySelection(): ApplySelection {
    return this.sharedContext
      ? ApplySelection.fromContext(this.sharedContext, {
          claudeHome: this.claudeHome,
          credentialStore: this.credentialStore,
          secureSnapshotStore: this.secureSnapshotStore,
          logger: this.logger.child({ scope: "apply-selection" }),
        })
      : ApplySelection.open(this.databasePath, {
          claudeHome: this.claudeHome,
          credentialStore: this.credentialStore,
          secureSnapshotStore: this.secureSnapshotStore,
          logger: this.logger.child({ scope: "apply-selection" }),
        });
  }

  protected openImporter(): ImportCurrentConnection {
    return this.sharedContext
      ? ImportCurrentConnection.fromContext(this.sharedContext, {
          claudeHome: this.claudeHome,
          credentialStore: this.credentialStore,
          logger: this.logger.child({ scope: "import-current-connection" }),
        })
      : ImportCurrentConnection.open(this.databasePath, {
          claudeHome: this.claudeHome,
          credentialStore: this.credentialStore,
          logger: this.logger.child({ scope: "import-current-connection" }),
        });
  }

  rollbackLatestMutation(): RollbackLatestAgentResult {
    const rollback = this.sharedContext
      ? RollbackLatestMutation.fromContext(this.sharedContext, {
          claudeHome: this.claudeHome,
          credentialStore: this.credentialStore,
          secureSnapshotStore: this.secureSnapshotStore,
          logger: this.logger.child({ scope: "rollback-latest-mutation" }),
        })
      : RollbackLatestMutation.open(this.databasePath, {
          claudeHome: this.claudeHome,
          credentialStore: this.credentialStore,
          secureSnapshotStore: this.secureSnapshotStore,
          logger: this.logger.child({ scope: "rollback-latest-mutation" }),
        });
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
    if (this.sharedContext) {
      return CurrentStateDetector.fromContext(this.sharedContext, {
        claudeHome: this.claudeHome,
        credentialStore: this.credentialStore,
        logger: this.logger.child({ scope: "current-state-detector" }),
      });
    }
    return CurrentStateDetector.open(this.databasePath, {
      claudeHome: this.claudeHome,
      credentialStore: this.credentialStore,
      logger: this.logger.child({ scope: "current-state-detector" }),
    });
  }
}
