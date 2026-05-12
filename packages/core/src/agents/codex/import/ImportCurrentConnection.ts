import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../../services/credential/Store";
import { EnvironmentSource } from "../../../services/EnvironmentSource";
import { NileLogger } from "../../../services/NileLogger";
import {
  LiveSetupImportSupport,
  requireResolvedImportCandidate,
} from "../../../actions/live-setup/Import";
import { CodexAuthStore } from "../stores/CodexAuthStore";
import { CodexConfigStore } from "../stores/CodexConfigStore";
import {
  AgentWorkspaceSession,
} from "../../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../../runtime-local/AgentWorkspaceContext";
import { CODEX_AGENT_ID } from "../types";
import { LiveSetupMatcher } from "../../../actions/live-setup/Matcher";
import { LiveSetupReader } from "../live-setup/Reader";
import { LiveSetupDetector } from "../live-setup/Detector";

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
    const reader = new LiveSetupReader(authStore, configStore, environment);

    return new ImportCurrentConnection(
      new LiveSetupImportSupport(
        CODEX_AGENT_ID,
        "Codex",
        context.sharedContext.endpointRegistry,
        context.sharedContext.accessRegistry,
        context.agentSelection,
        context.sharedContext.agentConnectionSettings,
        logger,
      ),
      new LiveSetupDetector(
        reader,
        new LiveSetupMatcher(
          context.sharedContext.endpointRegistry,
          context.sharedContext.accessRegistry,
          context.agentSelection,
          CODEX_AGENT_ID,
          context.sharedContext.agentConnectionSettings,
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
    const reader = new LiveSetupReader(
      new CodexAuthStore({ codexHome }),
      new CodexConfigStore(codexHome),
      environment,
    );

    return new ImportCurrentConnection(
      new LiveSetupImportSupport(
        CODEX_AGENT_ID,
        "Codex",
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        context.agentConnectionSettings,
        logger,
      ),
      LiveSetupDetector.fromContext(context, {
        codexHome,
        credentialStore,
        environment,
        logger: logger.child({ scope: "detector" }),
      }),
      reader,
    );
  }

  constructor(
    private readonly importSupport: LiveSetupImportSupport,
    private readonly detector: LiveSetupDetector,
    private readonly reader: LiveSetupReader,
    private readonly ownedContext: AgentWorkspaceSession | null = null,
  ) {}

  async importCurrent() {
    return await this.importSupport.importDetected(
      this.detector.detect(),
      () => requireResolvedImportCandidate("Codex", this.reader.read()),
    );
  }

  close(): void {
    this.ownedContext?.close();
  }
}
