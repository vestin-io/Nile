import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { CursorDetectedAccess, CursorDetectedEndpoint, CursorDetectedLiveSetup } from "../types";
import { CURSOR_AGENT_ID } from "../types";
import type { ReadLiveSetupResult } from "./Internal";
import { AbstractAgentStateDetector } from "@nile/core/runtime-local/AbstractAgentStateDetector";
import {
  AgentWorkspaceBinding,
} from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { LiveSetupMatcher } from "@nile/core/actions/live-setup";
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
    const binding = AgentWorkspaceBinding.open(databasePath, credentialStore);

    const reader = new LiveSetupReader(
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
      options?.environment ?? EnvironmentSource.from(process.env),
    );
    return new LiveSetupDetector(
      reader,
      binding.createLiveSetupMatcher(CURSOR_AGENT_ID),
      options?.logger ?? NileLogger.silent().child({ module: "cursor-live-setup-detector" }),
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
  ): LiveSetupDetector {
    const cursorHome = options?.cursorHome ?? join(homedir(), ".cursor");
    const credentialStore = options.credentialStore;
    const binding = AgentWorkspaceBinding.fromContext(context);
    const reader = new LiveSetupReader(
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
      options?.environment ?? EnvironmentSource.from(process.env),
    );
    return new LiveSetupDetector(
      reader,
      binding.createLiveSetupMatcher(CURSOR_AGENT_ID),
      options?.logger ?? NileLogger.silent().child({ module: "cursor-live-setup-detector" }),
    );
  }

  constructor(
    private readonly reader: LiveSetupReader,
    matcher: LiveSetupMatcher,
    logger: NileLogger,
    ownedContext: { close(): void } | null = null,
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
