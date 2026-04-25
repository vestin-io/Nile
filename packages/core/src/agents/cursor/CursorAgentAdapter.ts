import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { EnvironmentSource } from "../../services/EnvironmentSource";
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

  readonly capabilities: AgentAdapterCapabilities = {
    detect: "yes",
    apply: "yes",
    import: "yes",
    history: "yes",
    rollback: "yes",
    desktopSupport: "no",
  };

  private readonly databasePath: string;
  private readonly cursorHome: string;
  private readonly credentialStore: CredentialStore;
  private readonly environment: EnvironmentSource;
  private readonly secureSnapshotStore: CursorAgentAdapterOptions["secureSnapshotStore"];
  private readonly logger: NileLogger;
  private readonly sharedContext: SharedAgentAdapterContext | undefined;

  constructor(options: CursorAgentAdapterOptions) {
    super();
    this.databasePath = options.databasePath;
    this.cursorHome = options.cursorHome ?? join(homedir(), ".cursor");
    this.credentialStore = options.credentialStore;
    this.environment = options.environment ?? EnvironmentSource.from(process.env);
    this.secureSnapshotStore = options.secureSnapshotStore;
    this.logger = options.logger ?? NileLogger.silent().child({ module: "cursor-agent-adapter" });
    this.sharedContext = options.sharedContext;
  }

  protected openApplySelection(): ApplySelection {
    return this.sharedContext
      ? ApplySelection.fromContext(this.sharedContext, {
          cursorHome: this.cursorHome,
          credentialStore: this.credentialStore,
          secureSnapshotStore: this.secureSnapshotStore,
          logger: this.logger.child({ scope: "apply-selection" }),
        })
      : ApplySelection.open(this.databasePath, {
          cursorHome: this.cursorHome,
          credentialStore: this.credentialStore,
          secureSnapshotStore: this.secureSnapshotStore,
          logger: this.logger.child({ scope: "apply-selection" }),
        });
  }

  protected openImporter(): ImportCurrentConnection {
    return this.sharedContext
      ? ImportCurrentConnection.fromContext(this.sharedContext, {
          cursorHome: this.cursorHome,
          credentialStore: this.credentialStore,
          environment: this.environment,
          logger: this.logger.child({ scope: "import-current-connection" }),
        })
      : ImportCurrentConnection.open(this.databasePath, {
          cursorHome: this.cursorHome,
          credentialStore: this.credentialStore,
          environment: this.environment,
          logger: this.logger.child({ scope: "import-current-connection" }),
        });
  }

  rollbackLatestMutation(): RollbackLatestAgentResult {
    const rollback = this.sharedContext
      ? RollbackLatestMutation.fromContext(this.sharedContext, {
          cursorHome: this.cursorHome,
          credentialStore: this.credentialStore,
          secureSnapshotStore: this.secureSnapshotStore,
          logger: this.logger.child({ scope: "rollback-latest-mutation" }),
        })
      : RollbackLatestMutation.open(this.databasePath, {
          cursorHome: this.cursorHome,
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
        cursorHome: this.cursorHome,
        credentialStore: this.credentialStore,
        environment: this.environment,
        logger: this.logger.child({ scope: "current-state-detector" }),
      });
    }
    return CurrentStateDetector.open(this.databasePath, {
      cursorHome: this.cursorHome,
      credentialStore: this.credentialStore,
      environment: this.environment,
      logger: this.logger.child({ scope: "current-state-detector" }),
    });
  }
}
