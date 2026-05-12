import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../../services/credential/Store";
import { EnvironmentSource } from "../../../services/EnvironmentSource";
import { NileLogger } from "../../../services/NileLogger";
import type { CursorDetectedAccess, CursorDetectedEndpoint, CursorDetectedLiveSetup } from "../types";
import { CURSOR_AGENT_ID } from "../types";
import type { ReadLiveSetupResult } from "./Internal";
import { AbstractAgentStateDetector } from "../../../runtime-local/AbstractAgentStateDetector";
import {
  AgentWorkspaceSession,
} from "../../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../../runtime-local/AgentWorkspaceContext";
import { LiveSetupMatcher } from "../../../actions/live-setup/Matcher";
import { LiveSetupReader } from "./Reader";
import { CursorConfigStore } from "../stores/CursorConfigStore";
import { CursorCredentialStore } from "../stores/CursorCredentialStore";

export class LiveSetupDetector extends AbstractAgentStateDetector<CursorDetectedLiveSetup> {
  static open(
    databasePath: string,
    options: {
      cursorHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      logger?: NileLogger;
    },
  ): LiveSetupDetector {
    const cursorHome = options?.cursorHome ?? join(homedir(), ".cursor");
    const credentialStore = options.credentialStore;
    const context = AgentWorkspaceSession.open(databasePath, credentialStore);

    const reader = new LiveSetupReader(
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
      options?.environment ?? EnvironmentSource.from(process.env),
    );
    const matcher = new LiveSetupMatcher(
      context.sharedContext.endpointRegistry,
      context.sharedContext.accessRegistry,
      context.agentSelection,
      CURSOR_AGENT_ID,
      context.sharedContext.agentConnectionSettings,
    );
    return new LiveSetupDetector(
      reader,
      matcher,
      options?.logger ?? NileLogger.silent().child({ module: "cursor-live-setup-detector" }),
      context,
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
  ): LiveSetupDetector {
    const cursorHome = options?.cursorHome ?? join(homedir(), ".cursor");
    const credentialStore = options.credentialStore;
    const reader = new LiveSetupReader(
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
      options?.environment ?? EnvironmentSource.from(process.env),
    );
    const matcher = new LiveSetupMatcher(
      context.endpointRegistry,
      context.accessRegistry,
      context.agentSelection,
      CURSOR_AGENT_ID,
      context.agentConnectionSettings,
    );
    return new LiveSetupDetector(
      reader,
      matcher,
      options?.logger ?? NileLogger.silent().child({ module: "cursor-live-setup-detector" }),
    );
  }

  constructor(
    private readonly reader: LiveSetupReader,
    matcher: LiveSetupMatcher,
    logger: NileLogger,
    ownedContext: AgentWorkspaceSession | null = null,
  ) {
    super(matcher, logger, ownedContext);
  }

  detect(): CursorDetectedLiveSetup {
    this.logger.info("cursor.detect.start", {});

    const readResult = this.reader.read();
    const result = this.buildDetectedState(readResult);

    this.logger.info("cursor.detect.result", {
      validity: result.validity,
      endpointFamily: result.endpoint?.endpointFamily,
      endpointIdHint: result.endpoint?.endpointIdHint,
      authMode: result.access?.authMode,
      matchedEndpointId: result.matchedConnection?.endpointId,
      matchedAccessId: result.matchedConnection?.accessId,
    });

    return result;
  }

  private buildDetectedState(readResult: ReadLiveSetupResult): CursorDetectedLiveSetup {
    if (readResult.kind === "invalid_structure") {
      return {
        agentId: CURSOR_AGENT_ID,
        validity: "invalid_structure",
        issues: readResult.issues,
        endpoint: null,
        access: null,
        matchedConnection: null,
      };
    }

    if (readResult.kind === "invalid_semantics") {
      return {
        agentId: CURSOR_AGENT_ID,
        validity: "invalid_semantics",
        issues: readResult.issues,
        endpoint: readResult.endpoint,
        access: readResult.access,
        matchedConnection: null,
      };
    }

    const matchResult = this.matcher.match(readResult.value);
    return {
      agentId: CURSOR_AGENT_ID,
      validity: matchResult.validity,
      issues: [],
      endpoint: readResult.value.detectedEndpoint,
      access: readResult.value.detectedAccess,
      matchedConnection: matchResult.matchedConnection,
    };
  }
}
