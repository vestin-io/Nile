import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { EnvironmentSource } from "../../services/EnvironmentSource";
import { SecureSnapshotStore } from "../../services/history/SecureSnapshotStore";
import { NileLogger } from "../../services/NileLogger";
import type {
  RollbackLatestAgentResult,
  AgentAdapterCapabilities,
} from "../../runtime-local/AgentAdapterTypes";
import { ManagedAgentAdapter } from "../../runtime-local/ManagedAgentAdapter";
import type { SharedAgentAdapterContext } from "../../runtime-local/AgentAdapterContext";
import { ApplySelection } from "./apply/ApplySelection";
import { CurrentStateDetector } from "./current-state/Detector";
import { ImportCurrentConnection } from "./import/ImportCurrentConnection";
import { RollbackLatestMutation } from "./rollback/RollbackLatestMutation";
import { CODEX_AGENT_ID } from "./types";

export type CodexAgentAdapterOptions = {
  databasePath: string;
  codexHome?: string;
  credentialStore: CredentialStore;
  environment?: EnvironmentSource;
  secureSnapshotStore?: SecureSnapshotStore;
  logger?: NileLogger;
  sharedContext?: SharedAgentAdapterContext;
};

export class CodexAgentAdapter extends ManagedAgentAdapter {
  readonly agentId = CODEX_AGENT_ID;

  readonly capabilities: AgentAdapterCapabilities = {
    detect: "yes",
    apply: "yes",
    import: "yes",
    history: "yes",
    rollback: "yes",
    desktopSupport: "partial",
  };

  private readonly databasePath: string;
  private readonly codexHome: string;
  private readonly credentialStore: CredentialStore;
  private readonly environment: EnvironmentSource;
  private readonly secureSnapshotStore: SecureSnapshotStore | undefined;
  private readonly logger: NileLogger;
  private readonly sharedContext: SharedAgentAdapterContext | undefined;

  constructor(options: CodexAgentAdapterOptions) {
    super();
    this.databasePath = options.databasePath;
    this.codexHome = options.codexHome ?? join(homedir(), ".codex");
    this.credentialStore = options.credentialStore;
    this.environment = options.environment ?? EnvironmentSource.from(process.env);
    this.secureSnapshotStore = options.secureSnapshotStore;
    this.logger = options.logger ?? NileLogger.silent().child({ module: "codex-agent-adapter" });
    this.sharedContext = options.sharedContext;
  }

  protected openApplySelection(): ApplySelection {
    return this.sharedContext
      ? ApplySelection.fromContext(this.sharedContext, {
          codexHome: this.codexHome,
          credentialStore: this.credentialStore,
          secureSnapshotStore: this.secureSnapshotStore,
          logger: this.logger.child({ scope: "apply-selection" }),
        })
      : ApplySelection.open(this.databasePath, {
          codexHome: this.codexHome,
          credentialStore: this.credentialStore,
          secureSnapshotStore: this.secureSnapshotStore,
          logger: this.logger.child({ scope: "apply-selection" }),
        });
  }

  protected openImporter(): ImportCurrentConnection {
    return this.sharedContext
      ? ImportCurrentConnection.fromContext(this.sharedContext, {
          codexHome: this.codexHome,
          credentialStore: this.credentialStore,
          environment: this.environment,
          logger: this.logger.child({ scope: "import-current-connection" }),
        })
      : ImportCurrentConnection.open(this.databasePath, {
          codexHome: this.codexHome,
          credentialStore: this.credentialStore,
          environment: this.environment,
          logger: this.logger.child({ scope: "import-current-connection" }),
        });
  }

  rollbackLatestMutation(): RollbackLatestAgentResult {
    const rollback = this.sharedContext
      ? RollbackLatestMutation.fromContext(this.sharedContext, {
          codexHome: this.codexHome,
          credentialStore: this.credentialStore,
          secureSnapshotStore: this.secureSnapshotStore,
          logger: this.logger.child({ scope: "rollback-latest-mutation" }),
        })
      : RollbackLatestMutation.open(this.databasePath, {
          codexHome: this.codexHome,
          credentialStore: this.credentialStore,
          secureSnapshotStore: this.secureSnapshotStore,
          logger: this.logger.child({ scope: "rollback-latest-mutation" }),
        });

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
    if (this.sharedContext) {
      return CurrentStateDetector.fromContext(this.sharedContext, {
        codexHome: this.codexHome,
        credentialStore: this.credentialStore,
        environment: this.environment,
        logger: this.logger.child({ scope: "current-state-detector" }),
      });
    }
    return CurrentStateDetector.open(this.databasePath, {
      codexHome: this.codexHome,
      credentialStore: this.credentialStore,
      environment: this.environment,
      logger: this.logger.child({ scope: "current-state-detector" }),
    });
  }
}
