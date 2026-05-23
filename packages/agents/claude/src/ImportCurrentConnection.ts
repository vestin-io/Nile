import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import {
  LiveSetupImportSupport,
  requireResolvedImportCandidate,
} from "@nile/core/actions/live-setup";
import type { ImportCurrentConnectionInput } from "@nile/core/models/agent/Adapter";
import {
  AgentWorkspaceBinding,
} from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { LiveSetupDetector } from "./live-setup/Detector";
import { CLAUDE_AGENT_ID } from "./types";
import { LiveSetupMatcher } from "@nile/core/actions/live-setup";
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
    const binding = AgentWorkspaceBinding.open(databasePath, credentialStore);
    const settingsStore = new ClaudeSettingsStore(claudeHome);
    const reader = new LiveSetupReader(
      settingsStore,
      new ClaudeCredentialStore(claudeHome),
    );

    return new ImportCurrentConnection(
      binding.createLiveSetupImportSupport(CLAUDE_AGENT_ID, "Claude", logger),
      new LiveSetupDetector(
        reader,
        binding.createLiveSetupMatcher(CLAUDE_AGENT_ID),
        logger.child({ scope: "detector" }),
      ),
      reader,
      binding,
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
    const binding = AgentWorkspaceBinding.fromContext(context);
    const settingsStore = new ClaudeSettingsStore(claudeHome);
    const reader = new LiveSetupReader(
      settingsStore,
      new ClaudeCredentialStore(claudeHome),
    );

    return new ImportCurrentConnection(
      binding.createLiveSetupImportSupport(CLAUDE_AGENT_ID, "Claude", logger),
      LiveSetupDetector.fromContext(binding.context, {
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
    private readonly ownedContext: { close(): void } | null = null,
  ) {}

  async importCurrent(input?: ImportCurrentConnectionInput) {
    return await this.importSupport.importDetected(
      this.detector.detect(),
      () => requireResolvedImportCandidate("Claude", this.reader.read()),
      input,
    );
  }

  close(): void {
    this.ownedContext?.close();
  }
}
