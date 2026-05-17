import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { NileLogger } from "@nile/core/services/NileLogger";
import {
  LiveSetupImportSupport,
  requireResolvedImportCandidate,
} from "@nile/core/actions/live-setup";
import { CodexAuthStore } from "../stores/CodexAuthStore";
import { CodexConfigStore } from "../stores/CodexConfigStore";
import { AgentWorkspaceBinding } from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { CODEX_AGENT_ID } from "../types";
import { LiveSetupMatcher } from "@nile/core/actions/live-setup";
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
    const binding = AgentWorkspaceBinding.open(databasePath, credentialStore);
    const authStore = new CodexAuthStore({ codexHome });
    const configStore = new CodexConfigStore(codexHome);
    const reader = new LiveSetupReader(authStore, configStore, environment);

    return new ImportCurrentConnection(
      binding.createLiveSetupImportSupport(CODEX_AGENT_ID, "Codex", logger),
      new LiveSetupDetector(
        reader,
        binding.createLiveSetupMatcher(CODEX_AGENT_ID),
        logger.child({ scope: "detector" }),
      ),
      reader,
      binding,
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
    const binding = AgentWorkspaceBinding.fromContext(context);
    const reader = new LiveSetupReader(
      new CodexAuthStore({ codexHome }),
      new CodexConfigStore(codexHome),
      environment,
    );

    return new ImportCurrentConnection(
      binding.createLiveSetupImportSupport(CODEX_AGENT_ID, "Codex", logger),
      LiveSetupDetector.fromContext(binding.context, {
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
    private readonly ownedContext: { close(): void } | null = null,
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
