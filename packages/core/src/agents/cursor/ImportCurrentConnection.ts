import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { EnvironmentSource } from "../../services/EnvironmentSource";
import { NileLogger } from "../../services/NileLogger";
import {
  AgentImportSupport,
  requireResolvedImportCandidate,
} from "../../actions/import/ImportSupport";
import {
  AgentAdapterContextSession,
  type SharedAgentAdapterContext,
} from "../../runtime-local/AgentAdapterContext";
import { CurrentStateDetector } from "./current-state/Detector";
import { CURSOR_AGENT_ID } from "./types";
import { AgentStateMatcher } from "../../actions/import/StateMatcher";
import { CurrentStateReader } from "./current-state/Reader";
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
    const context = AgentAdapterContextSession.open(databasePath, credentialStore);
    const configStore = new CursorConfigStore(cursorHome);
    const cursorCredentialStore = new CursorCredentialStore();
    const reader = new CurrentStateReader(
      configStore,
      cursorCredentialStore,
      environment,
    );

    return new ImportCurrentConnection(
      new AgentImportSupport(
        CURSOR_AGENT_ID,
        "Cursor",
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        logger,
      ),
      new CurrentStateDetector(
        reader,
        new AgentStateMatcher(
          context.endpointRegistry,
          context.accessRegistry,
          context.agentSelection,
          CURSOR_AGENT_ID,
        ),
        logger.child({ scope: "detector" }),
      ),
      reader,
      context,
    );
  }

  static fromContext(
    context: SharedAgentAdapterContext,
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
    const reader = new CurrentStateReader(
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
      environment,
    );

    return new ImportCurrentConnection(
      new AgentImportSupport(
        CURSOR_AGENT_ID,
        "Cursor",
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        logger,
      ),
      CurrentStateDetector.fromContext(context, {
        cursorHome,
        credentialStore,
        environment,
        logger: logger.child({ scope: "detector" }),
      }),
      reader,
    );
  }

  constructor(
    private readonly importSupport: AgentImportSupport,
    private readonly detector: CurrentStateDetector,
    private readonly reader: CurrentStateReader,
    private readonly ownedContext: AgentAdapterContextSession | null = null,
  ) {}

  importCurrent() {
    return this.importSupport.importDetected(
      this.detector.detect(),
      () => requireResolvedImportCandidate("Cursor", this.reader.read()),
    );
  }

  close(): void {
    this.ownedContext?.close();
  }
}
