import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
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
import { CLAUDE_AGENT_ID } from "./types";
import { LiveSetupMatcher } from "../../actions/live-setup/Matcher";
import { LiveSetupReader } from "./live-setup/Reader";
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
    const reader = new LiveSetupReader(
      settingsStore,
      new ClaudeCredentialStore(claudeHome),
    );

    return new ImportCurrentConnection(
      new LiveSetupImportSupport(
        CLAUDE_AGENT_ID,
        "Claude",
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
          CLAUDE_AGENT_ID,
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
      claudeHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const claudeHome = options?.claudeHome ?? join(homedir(), ".claude");
    const credentialStore = options.credentialStore;
    const logger = options?.logger ?? NileLogger.silent().child({ module: "claude-import-current-connection" });
    const settingsStore = new ClaudeSettingsStore(claudeHome);
    const reader = new LiveSetupReader(
      settingsStore,
      new ClaudeCredentialStore(claudeHome),
    );

    return new ImportCurrentConnection(
      new LiveSetupImportSupport(
        CLAUDE_AGENT_ID,
        "Claude",
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        context.agentConnectionSettings,
        logger,
      ),
      LiveSetupDetector.fromContext(context, {
        claudeHome,
        credentialStore,
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
      () => requireResolvedImportCandidate("Claude", this.reader.read()),
    );
  }

  close(): void {
    this.ownedContext?.close();
  }
}
