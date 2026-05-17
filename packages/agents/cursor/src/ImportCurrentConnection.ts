import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { NileLogger } from "@nile/core/services/NileLogger";
import {
  LiveSetupImportSupport,
  requireResolvedImportCandidate,
} from "@nile/core/actions/live-setup";
import {
  AgentWorkspaceBinding,
} from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { LiveSetupDetector } from "./live-setup/Detector";
import { CURSOR_AGENT_ID } from "./types";
import { LiveSetupMatcher } from "@nile/core/actions/live-setup";
import { LiveSetupReader } from "./live-setup/Reader";
import { CursorConfigStore } from "./stores/CursorConfigStore";
import { CursorCredentialStore } from "./stores/CursorCredentialStore";

export class ImportCurrentConnection {
  static open(
    databasePath: string,
    options: {
      cursorHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const cursorHome = options?.cursorHome ?? join(homedir(), ".cursor");
    const credentialStore = options.credentialStore;
    const environment = options?.environment ?? EnvironmentSource.from(process.env);
    const logger = options?.logger ?? NileLogger.silent().child({ module: "cursor-import-current-connection" });
    const binding = AgentWorkspaceBinding.open(databasePath, credentialStore);
    const configStore = new CursorConfigStore(cursorHome);
    const cursorCredentialStore = new CursorCredentialStore();
    const reader = new LiveSetupReader(
      configStore,
      cursorCredentialStore,
      environment,
    );

    return new ImportCurrentConnection(
      binding.createLiveSetupImportSupport(CURSOR_AGENT_ID, "Cursor", logger),
      new LiveSetupDetector(
        reader,
        binding.createLiveSetupMatcher(CURSOR_AGENT_ID),
        logger.child({ scope: "detector" }),
      ),
      reader,
      binding,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      cursorHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      logger?: NileLogger;
    },
  ): ImportCurrentConnection {
    const cursorHome = options?.cursorHome ?? join(homedir(), ".cursor");
    const credentialStore = options.credentialStore;
    const environment = options?.environment ?? EnvironmentSource.from(process.env);
    const logger = options?.logger ?? NileLogger.silent().child({ module: "cursor-import-current-connection" });
    const binding = AgentWorkspaceBinding.fromContext(context);
    const reader = new LiveSetupReader(
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
      environment,
    );

    return new ImportCurrentConnection(
      binding.createLiveSetupImportSupport(CURSOR_AGENT_ID, "Cursor", logger),
      LiveSetupDetector.fromContext(binding.context, {
        cursorHome,
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
      () => requireResolvedImportCandidate("Cursor", this.reader.read()),
    );
  }

  close(): void {
    this.ownedContext?.close();
  }
}
