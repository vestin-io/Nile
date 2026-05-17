import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import {
  LiveSetupImportSupport,
  requireResolvedImportCandidate,
} from "@nile/core/actions/live-setup";
import { LiveSetupMatcher } from "@nile/core/actions/live-setup";
import {
  AgentWorkspaceBinding,
} from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
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
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const openclawHome = options?.openclawHome ?? join(homedir(), ".openclaw");
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-import-current-connection" });
    const binding = AgentWorkspaceBinding.open(databasePath, options.credentialStore);
    const reader = new LiveSetupReader(
      new OpenClawConfigStore(openclawHome),
      new OpenClawAuthProfileStore(openclawHome),
    );

    return new ImportCurrentConnection(
      binding.createLiveSetupImportSupport(OPENCLAW_AGENT_ID, "OpenClaw", logger),
      new LiveSetupDetector(
        reader,
        binding.createLiveSetupMatcher(OPENCLAW_AGENT_ID),
        logger.child({ scope: "detector" }),
      ),
      reader,
      binding,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      openclawHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const openclawHome = options?.openclawHome ?? join(homedir(), ".openclaw");
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-import-current-connection" });
    const binding = AgentWorkspaceBinding.fromContext(context);
    const reader = new LiveSetupReader(
      new OpenClawConfigStore(openclawHome),
      new OpenClawAuthProfileStore(openclawHome),
    );

    return new ImportCurrentConnection(
      binding.createLiveSetupImportSupport(OPENCLAW_AGENT_ID, "OpenClaw", logger),
      LiveSetupDetector.fromContext(binding.context, {
        openclawHome,
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
      () => requireResolvedImportCandidate("OpenClaw", this.reader.read()),
    );
  }

  close(): void {
    this.ownedContext?.close();
  }
}
