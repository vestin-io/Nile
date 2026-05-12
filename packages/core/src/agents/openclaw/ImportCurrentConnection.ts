import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { NileLogger } from "../../services/NileLogger";
import {
  LiveSetupImportSupport,
  requireResolvedImportCandidate,
} from "../../actions/live-setup/Import";
import { LiveSetupMatcher } from "../../actions/live-setup/Matcher";
import {
  AgentWorkspaceSession,
} from "../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../runtime-local/AgentWorkspaceContext";
import { CodexAuthStore } from "../codex/stores/CodexAuthStore";
import { OpenClawAuthProfileStore } from "./AuthProfileStore";
import { OPENCLAW_AGENT_ID } from "./types";
import { OpenClawConfigStore } from "./OpenClawConfigStore";
import { LiveSetupDetector } from "./live-setup/Detector";
import { LiveSetupReader } from "./live-setup/Reader";

export class ImportCurrentConnection {
  static open(
    databasePath: string,
    options: {
      openclawHome?: string;
      codexHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const openclawHome = options?.openclawHome ?? join(homedir(), ".openclaw");
    const codexHome = options?.codexHome ?? join(homedir(), ".codex");
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-import-current-connection" });
    const context = AgentWorkspaceSession.open(databasePath, options.credentialStore);
    const reader = new LiveSetupReader(
      new OpenClawConfigStore(openclawHome),
      new OpenClawAuthProfileStore(openclawHome),
      new CodexAuthStore({ codexHome }),
    );

    return new ImportCurrentConnection(
      new LiveSetupImportSupport(
        OPENCLAW_AGENT_ID,
        "OpenClaw",
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
          OPENCLAW_AGENT_ID,
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
      openclawHome?: string;
      codexHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const openclawHome = options?.openclawHome ?? join(homedir(), ".openclaw");
    const codexHome = options?.codexHome ?? join(homedir(), ".codex");
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-import-current-connection" });
    const reader = new LiveSetupReader(
      new OpenClawConfigStore(openclawHome),
      new OpenClawAuthProfileStore(openclawHome),
      new CodexAuthStore({ codexHome }),
    );

    return new ImportCurrentConnection(
      new LiveSetupImportSupport(
        OPENCLAW_AGENT_ID,
        "OpenClaw",
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        context.agentConnectionSettings,
        logger,
      ),
      LiveSetupDetector.fromContext(context, {
        openclawHome,
        codexHome,
        credentialStore: options.credentialStore,
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
      () => requireResolvedImportCandidate("OpenClaw", this.reader.read()),
    );
  }

  close(): void {
    this.ownedContext?.close();
  }
}
