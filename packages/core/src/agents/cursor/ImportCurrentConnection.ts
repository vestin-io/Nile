import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { EnvironmentSource } from "../../services/EnvironmentSource";
import { NileLogger } from "../../services/NileLogger";
import {
  LiveSetupImportSupport,
  requireResolvedImportCandidate,
} from "../../actions/live-setup/Import";
import {
  AgentWorkspaceSession,
} from "../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../runtime-local/AgentWorkspaceContext";
import { LiveSetupDetector } from "./live-setup/Detector";
import { CURSOR_AGENT_ID } from "./types";
import { LiveSetupMatcher } from "../../actions/live-setup/Matcher";
import { LiveSetupReader } from "./live-setup/Reader";
import { CursorConfigStore } from "./stores/CursorConfigStore";
import { CursorCredentialStore } from "./stores/CursorCredentialStore";

export class ImportCurrentConnection {
  static open(
    databasePath: string,
    options: {
      cursorHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const cursorHome = options?.cursorHome ?? join(homedir(), ".cursor");
    const credentialStore = options.credentialStore;
    const environment = options?.environment ?? EnvironmentSource.from(process.env);
    const logger = options?.logger ?? NileLogger.silent().child({ module: "cursor-import-current-connection" });
    const context = AgentWorkspaceSession.open(databasePath, credentialStore);
    const configStore = new CursorConfigStore(cursorHome);
    const cursorCredentialStore = new CursorCredentialStore();
    const reader = new LiveSetupReader(
      configStore,
      cursorCredentialStore,
      environment,
    );

    return new ImportCurrentConnection(
      new LiveSetupImportSupport(
        CURSOR_AGENT_ID,
        "Cursor",
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
          CURSOR_AGENT_ID,
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
      cursorHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const cursorHome = options?.cursorHome ?? join(homedir(), ".cursor");
    const credentialStore = options.credentialStore;
    const environment = options?.environment ?? EnvironmentSource.from(process.env);
    const logger = options?.logger ?? NileLogger.silent().child({ module: "cursor-import-current-connection" });
    const reader = new LiveSetupReader(
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
      environment,
    );

    return new ImportCurrentConnection(
      new LiveSetupImportSupport(
        CURSOR_AGENT_ID,
        "Cursor",
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        context.agentConnectionSettings,
        logger,
      ),
      LiveSetupDetector.fromContext(context, {
        cursorHome,
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
      () => requireResolvedImportCandidate("Cursor", this.reader.read()),
    );
  }

  close(): void {
    this.ownedContext?.close();
  }
}
