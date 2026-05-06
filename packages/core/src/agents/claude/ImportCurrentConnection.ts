import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { NileLogger } from "../../services/NileLogger";
import {
  CurrentStateImportSupport,
  requireResolvedImportCandidate,
} from "../../actions/current-state/Import";
import {
  AgentWorkspaceSession,
} from "../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../runtime-local/AgentWorkspaceContext";
import { CurrentStateDetector } from "./current-state/Detector";
import { CLAUDE_AGENT_ID } from "./types";
import { CurrentStateMatcher } from "../../actions/current-state/Matcher";
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
    const context = AgentWorkspaceSession.open(databasePath, credentialStore);
    const settingsStore = new ClaudeSettingsStore(claudeHome);
    const reader = new CurrentStateReader(
      settingsStore,
      new ClaudeCredentialStore(claudeHome),
    );

    return new ImportCurrentConnection(
      new CurrentStateImportSupport(
        CLAUDE_AGENT_ID,
        "Claude",
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
          CLAUDE_AGENT_ID,
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
      new CurrentStateImportSupport(
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
    private readonly importSupport: CurrentStateImportSupport,
    private readonly detector: CurrentStateDetector,
    private readonly reader: CurrentStateReader,
    private readonly ownedContext: AgentWorkspaceSession | null = null,
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
