import { homedir } from "node:os";
import { join } from "node:path";

import {
  LiveSetupImportSupport,
  requireResolvedImportCandidate,
} from "@nile/core/actions/live-setup";
import type { ImportCurrentConnectionInput } from "@nile/core/models/agent/Adapter";
import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { AgentWorkspaceBinding } from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { OpenCodeAuthStore } from "./OpenCodeAuthStore";
import { OpenCodeConfigStore } from "./OpenCodeConfigStore";
import { LiveSetupDetector } from "./live-setup/Detector";
import { LiveSetupReader } from "./live-setup/Reader";
import { OPENCODE_AGENT_ID } from "./types";

export class ImportCurrentConnection {
  static open(
    databasePath: string,
    options: {
      opencodeHome?: string;
      opencodeDataHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const opencodeHome = options.opencodeHome ?? join(homedir(), ".config", "opencode");
    const opencodeDataHome = options.opencodeDataHome ?? join(homedir(), ".local", "share", "opencode");
    const logger = options.logger ?? NileLogger.silent().child({ module: "opencode-import-current-connection" });
    const binding = AgentWorkspaceBinding.open(databasePath, options.credentialStore);
    const reader = new LiveSetupReader(
      new OpenCodeConfigStore(opencodeHome),
      new OpenCodeAuthStore(opencodeDataHome),
    );

    return new ImportCurrentConnection(
      binding.createLiveSetupImportSupport(OPENCODE_AGENT_ID, "OpenCode", logger),
      new LiveSetupDetector(
        reader,
        binding.createLiveSetupMatcher(OPENCODE_AGENT_ID),
        logger.child({ scope: "detector" }),
      ),
      reader,
      binding,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      opencodeHome?: string;
      opencodeDataHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const opencodeHome = options.opencodeHome ?? join(homedir(), ".config", "opencode");
    const opencodeDataHome = options.opencodeDataHome ?? join(homedir(), ".local", "share", "opencode");
    const logger = options.logger ?? NileLogger.silent().child({ module: "opencode-import-current-connection" });
    const binding = AgentWorkspaceBinding.fromContext(context);
    const reader = new LiveSetupReader(
      new OpenCodeConfigStore(opencodeHome),
      new OpenCodeAuthStore(opencodeDataHome),
    );

    return new ImportCurrentConnection(
      binding.createLiveSetupImportSupport(OPENCODE_AGENT_ID, "OpenCode", logger),
      LiveSetupDetector.fromContext(binding.context, {
        opencodeHome,
        opencodeDataHome,
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

  async importCurrent(input?: ImportCurrentConnectionInput) {
    return await this.importSupport.importDetected(
      this.detector.detect(),
      () => requireResolvedImportCandidate("OpenCode", this.reader.read()),
      input,
    );
  }

  close(): void {
    this.ownedContext?.close();
  }
}
