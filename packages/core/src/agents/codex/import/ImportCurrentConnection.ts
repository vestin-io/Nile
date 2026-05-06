import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../../services/credential/Store";
import { EnvironmentSource } from "../../../services/EnvironmentSource";
import { NileLogger } from "../../../services/NileLogger";
import {
  CurrentStateImportSupport,
  requireResolvedImportCandidate,
} from "../../../actions/current-state/Import";
import { CodexAuthStore } from "../stores/CodexAuthStore";
import { CodexConfigStore } from "../stores/CodexConfigStore";
import {
  AgentWorkspaceSession,
} from "../../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../../runtime-local/AgentWorkspaceContext";
import { CODEX_AGENT_ID } from "../types";
import { CurrentStateMatcher } from "../../../actions/current-state/Matcher";
import { CurrentStateReader } from "../current-state/Reader";
import { CurrentStateDetector } from "../current-state/Detector";

export class ImportCurrentConnection {
  static open(
    databasePath: string,
    options: {
      codexHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const codexHome = options?.codexHome ?? join(homedir(), ".codex");
    const credentialStore = options.credentialStore;
    const environment = options?.environment ?? EnvironmentSource.from(process.env);
    const logger = options?.logger ?? NileLogger.silent().child({ module: "codex-import-current-connection" });
    const context = AgentWorkspaceSession.open(databasePath, credentialStore);
    const authStore = new CodexAuthStore({ codexHome });
    const configStore = new CodexConfigStore(codexHome);
    const reader = new CurrentStateReader(authStore, configStore, environment);

    return new ImportCurrentConnection(
      new CurrentStateImportSupport(
        CODEX_AGENT_ID,
        "Codex",
        context.sharedContext.endpointRegistry,
        context.sharedContext.accessRegistry,
        context.agentSelection,
        logger,
      ),
      new CurrentStateDetector(
        reader,
        new CurrentStateMatcher(
          context.sharedContext.endpointRegistry,
          context.sharedContext.accessRegistry,
          context.agentSelection,
          CODEX_AGENT_ID,
        ),
        logger.child({ scope: "detector" }),
      ),
      reader,
      context,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      codexHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const codexHome = options?.codexHome ?? join(homedir(), ".codex");
    const credentialStore = options.credentialStore;
    const environment = options?.environment ?? EnvironmentSource.from(process.env);
    const logger = options?.logger ?? NileLogger.silent().child({ module: "codex-import-current-connection" });
    const reader = new CurrentStateReader(
      new CodexAuthStore({ codexHome }),
      new CodexConfigStore(codexHome),
      environment,
    );

    return new ImportCurrentConnection(
      new CurrentStateImportSupport(
        CODEX_AGENT_ID,
        "Codex",
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        logger,
      ),
      CurrentStateDetector.fromContext(context, {
        codexHome,
        credentialStore,
        environment,
        logger: logger.child({ scope: "detector" }),
      }),
      reader,
    );
  }

  constructor(
    private readonly importSupport: CurrentStateImportSupport,
    private readonly detector: CurrentStateDetector,
    private readonly reader: CurrentStateReader,
    private readonly ownedContext: AgentWorkspaceSession | null = null,
  ) {}

  importCurrent() {
    return this.importSupport.importDetected(
      this.detector.detect(),
      () => requireResolvedImportCandidate("Codex", this.reader.read()),
    );
  }

  close(): void {
    this.ownedContext?.close();
  }
}
