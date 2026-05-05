import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
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
import { CLAUDE_AGENT_ID } from "./types";
import { AgentStateMatcher } from "../../actions/import/StateMatcher";
import { CurrentStateReader } from "./current-state/Reader";
import { ClaudeCredentialStore } from "./Store";
import { ClaudeSettingsStore } from "./SettingsStore";

export class ImportCurrentConnection {
  static open(
    databasePath: string,
    options: {
      claudeHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const claudeHome = options?.claudeHome ?? join(homedir(), ".claude");
    const credentialStore = options.credentialStore;
    const logger = options?.logger ?? NileLogger.silent().child({ module: "claude-import-current-connection" });
    const context = AgentAdapterContextSession.open(databasePath, credentialStore);
    const settingsStore = new ClaudeSettingsStore(claudeHome);
    const reader = new CurrentStateReader(
      settingsStore,
      new ClaudeCredentialStore(claudeHome),
    );

    return new ImportCurrentConnection(
      new AgentImportSupport(
        CLAUDE_AGENT_ID,
        "Claude",
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
          CLAUDE_AGENT_ID,
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
      claudeHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const claudeHome = options?.claudeHome ?? join(homedir(), ".claude");
    const credentialStore = options.credentialStore;
    const logger = options?.logger ?? NileLogger.silent().child({ module: "claude-import-current-connection" });
    const settingsStore = new ClaudeSettingsStore(claudeHome);
    const reader = new CurrentStateReader(
      settingsStore,
      new ClaudeCredentialStore(claudeHome),
    );

    return new ImportCurrentConnection(
      new AgentImportSupport(
        CLAUDE_AGENT_ID,
        "Claude",
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        logger,
      ),
      CurrentStateDetector.fromContext(context, {
        claudeHome,
        credentialStore,
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
      () => requireResolvedImportCandidate("Claude", this.reader.read()),
    );
  }

  close(): void {
    this.ownedContext?.close();
  }
}
