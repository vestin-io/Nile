import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import {
  LiveSetupImportSupport,
  requireResolvedImportCandidate,
} from "@nile/core/actions/live-setup";
import { AgentWorkspaceBinding } from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { GeminiAccountsStore } from "./AccountsStore";
import { GeminiCredentialBackend } from "./Backend";
import { GeminiCredentialStore } from "./CredentialStore";
import { GeminiKeychainCredentialStore } from "./KeychainStore";
import { GeminiSessionReader } from "./Reader";
import { GeminiSettingsStore } from "./SettingsStore";
import { LiveSetupDetector } from "./live-setup/Detector";
import { LiveSetupReader } from "./live-setup/Reader";
import { GeminiSessionStores } from "./Stores";
import { GEMINI_AGENT_ID } from "./types";

export class ImportCurrentConnection {
  static open(
    databasePath: string,
    options: {
      geminiHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const geminiHome = options.geminiHome ?? join(homedir(), ".gemini");
    const logger = options.logger ?? NileLogger.silent().child({ module: "gemini-import-current-connection" });
    const binding = AgentWorkspaceBinding.open(databasePath, options.credentialStore);
    const reader = createLiveSetupReader(geminiHome);

    return new ImportCurrentConnection(
      binding.createLiveSetupImportSupport(GEMINI_AGENT_ID, "Gemini", logger),
      new LiveSetupDetector(
        reader,
        binding.createLiveSetupMatcher(GEMINI_AGENT_ID),
        logger.child({ scope: "detector" }),
      ),
      reader,
      binding,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      geminiHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const geminiHome = options.geminiHome ?? join(homedir(), ".gemini");
    const logger = options.logger ?? NileLogger.silent().child({ module: "gemini-import-current-connection" });
    const binding = AgentWorkspaceBinding.fromContext(context);
    const reader = createLiveSetupReader(geminiHome);

    return new ImportCurrentConnection(
      binding.createLiveSetupImportSupport(GEMINI_AGENT_ID, "Gemini", logger),
      LiveSetupDetector.fromContext(binding.context, {
        geminiHome,
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
    private readonly ownedContext: { close(): void } | null = null,
  ) {}

  async importCurrent() {
    return await this.importSupport.importDetected(
      this.detector.detect(),
      () => requireResolvedImportCandidate("Gemini", this.reader.read()),
    );
  }

  close(): void {
    this.ownedContext?.close();
  }
}

function createLiveSetupReader(geminiHome: string): LiveSetupReader {
  return new LiveSetupReader(GeminiSessionStores.open(geminiHome).reader);
}
