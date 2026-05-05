import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { NileLogger } from "../../services/NileLogger";
import {
  AgentImportSupport,
  requireResolvedImportCandidate,
} from "../../actions/import/ImportSupport";
import { AgentStateMatcher } from "../../actions/import/StateMatcher";
import {
  AgentAdapterContextSession,
  type SharedAgentAdapterContext,
} from "../../runtime-local/AgentAdapterContext";
import { OPENCLAW_AGENT_ID } from "./types";
import { OpenClawConfigStore } from "./OpenClawConfigStore";
import { CurrentStateDetector } from "./current-state/Detector";
import { CurrentStateReader } from "./current-state/Reader";

export class ImportCurrentConnection {
  static open(
    databasePath: string,
    options: {
      openclawHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const openclawHome = options?.openclawHome ?? join(homedir(), ".openclaw");
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-import-current-connection" });
    const context = AgentAdapterContextSession.open(databasePath, options.credentialStore);
    const reader = new CurrentStateReader(new OpenClawConfigStore(openclawHome));

    return new ImportCurrentConnection(
      new AgentImportSupport(
        OPENCLAW_AGENT_ID,
        "OpenClaw",
        context.sharedContext.endpointRegistry,
        context.sharedContext.accessRegistry,
        context.agentSelection,
        logger,
      ),
      new CurrentStateDetector(
        reader,
        new AgentStateMatcher(
          context.sharedContext.endpointRegistry,
          context.sharedContext.accessRegistry,
          context.agentSelection,
          OPENCLAW_AGENT_ID,
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
      openclawHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const openclawHome = options?.openclawHome ?? join(homedir(), ".openclaw");
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-import-current-connection" });
    const reader = new CurrentStateReader(new OpenClawConfigStore(openclawHome));

    return new ImportCurrentConnection(
      new AgentImportSupport(
        OPENCLAW_AGENT_ID,
        "OpenClaw",
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        logger,
      ),
      CurrentStateDetector.fromContext(context, {
        openclawHome,
        credentialStore: options.credentialStore,
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
      () => requireResolvedImportCandidate("OpenClaw", this.reader.read()),
    );
  }

  close(): void {
    this.ownedContext?.close();
  }
}
