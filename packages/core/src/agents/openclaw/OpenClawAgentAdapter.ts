import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { EnvironmentSource } from "../../services/EnvironmentSource";
import { SecureSnapshotStore } from "../../services/history/SecureSnapshotStore";
import { NileLogger } from "../../services/NileLogger";
import type {
  AgentAdapterCapabilities,
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

  readonly capabilities: AgentAdapterCapabilities = {
    detect: "yes",
    apply: "yes",
    import: "yes",
    history: "yes",
    rollback: "yes",
    desktopSupport: "partial",
  };

  private readonly databasePath: string;
  private readonly openclawHome: string;
  private readonly credentialStore: CredentialStore;
  private readonly environment: EnvironmentSource;
  private readonly secureSnapshotStore: SecureSnapshotStore | undefined;
  private readonly logger: NileLogger;
  private readonly sharedContext: SharedAgentAdapterContext | undefined;

  constructor(options: OpenClawAgentAdapterOptions) {
    super();
    this.databasePath = options.databasePath;
    this.openclawHome = options.openclawHome ?? join(homedir(), ".openclaw");
    this.credentialStore = options.credentialStore;
    this.environment = options.environment ?? EnvironmentSource.from(process.env);
    this.secureSnapshotStore = options.secureSnapshotStore;
    this.logger = options.logger ?? NileLogger.silent().child({ module: "openclaw-agent-adapter" });
    this.sharedContext = options.sharedContext;
  }

  protected openApplySelection(): ApplySelection {
    return this.sharedContext
      ? ApplySelection.fromContext(this.sharedContext, {
          openclawHome: this.openclawHome,
          credentialStore: this.credentialStore,
          environment: this.environment,
          secureSnapshotStore: this.secureSnapshotStore,
          logger: this.logger.child({ scope: "apply-selection" }),
        })
      : ApplySelection.open(this.databasePath, {
          openclawHome: this.openclawHome,
          credentialStore: this.credentialStore,
          environment: this.environment,
          secureSnapshotStore: this.secureSnapshotStore,
          logger: this.logger.child({ scope: "apply-selection" }),
        });
  }

  protected openImporter(): ImportCurrentConnection {
    return this.sharedContext
      ? ImportCurrentConnection.fromContext(this.sharedContext, {
          openclawHome: this.openclawHome,
          credentialStore: this.credentialStore,
          logger: this.logger.child({ scope: "import-current-connection" }),
        })
      : ImportCurrentConnection.open(this.databasePath, {
          openclawHome: this.openclawHome,
          credentialStore: this.credentialStore,
          logger: this.logger.child({ scope: "import-current-connection" }),
        });
  }

  rollbackLatestMutation(): RollbackLatestAgentResult {
    const rollback = this.sharedContext
      ? RollbackLatestMutation.fromContext(this.sharedContext, {
          openclawHome: this.openclawHome,
          credentialStore: this.credentialStore,
          secureSnapshotStore: this.secureSnapshotStore,
          logger: this.logger.child({ scope: "rollback-latest-mutation" }),
        })
      : RollbackLatestMutation.open(this.databasePath, {
          openclawHome: this.openclawHome,
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
    return this.sharedContext
      ? CurrentStateDetector.fromContext(this.sharedContext, {
          openclawHome: this.openclawHome,
          credentialStore: this.credentialStore,
          logger: this.logger.child({ scope: "current-state-detector" }),
        })
      : CurrentStateDetector.open(this.databasePath, {
          openclawHome: this.openclawHome,
          credentialStore: this.credentialStore,
          logger: this.logger.child({ scope: "current-state-detector" }),
        });
  }
}
