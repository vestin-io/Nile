import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../../services/credential/Store";
import { EnvironmentSource } from "../../../services/EnvironmentSource";
import { NileLogger } from "../../../services/NileLogger";
import type { CursorDetectedAccess, CursorDetectedCurrentState, CursorDetectedEndpoint } from "../types";
import { CURSOR_AGENT_ID } from "../types";
import type { ReadCurrentStateResult } from "./Internal";
import { AbstractAgentStateDetector } from "../../../runtime-local/AbstractAgentStateDetector";
import {
  AgentAdapterContextSession,
  type SharedAgentAdapterContext,
} from "../../../runtime-local/AgentAdapterContext";
import { AgentStateMatcher } from "../../../actions/import/StateMatcher";
import { CurrentStateReader } from "./Reader";
import { CursorConfigStore } from "../stores/CursorConfigStore";
import { CursorCredentialStore } from "../stores/CursorCredentialStore";

export class CurrentStateDetector extends AbstractAgentStateDetector<CursorDetectedCurrentState> {
  static open(
    databasePath: string,
    options: {
      cursorHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      logger?: NileLogger;
    },
  ): CurrentStateDetector {
    const cursorHome = options?.cursorHome ?? join(homedir(), ".cursor");
    const credentialStore = options.credentialStore;
    const context = AgentAdapterContextSession.open(databasePath, credentialStore);

    const reader = new CurrentStateReader(
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
      options?.environment ?? EnvironmentSource.from(process.env),
    );
    const matcher = new AgentStateMatcher(
      context.sharedContext.endpointRegistry,
      context.sharedContext.accessRegistry,
      context.agentSelection,
      CURSOR_AGENT_ID,
    );
    return new CurrentStateDetector(
      reader,
      matcher,
      options?.logger ?? NileLogger.silent().child({ module: "cursor-current-state-detector" }),
      context,
    );
  }

  static fromContext(
    context: SharedAgentAdapterContext,
    options: {
      cursorHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      logger?: NileLogger;
    },
  ): CurrentStateDetector {
    const cursorHome = options?.cursorHome ?? join(homedir(), ".cursor");
    const credentialStore = options.credentialStore;
    const reader = new CurrentStateReader(
      new CursorConfigStore(cursorHome),
      new CursorCredentialStore(),
      options?.environment ?? EnvironmentSource.from(process.env),
    );
    const matcher = new AgentStateMatcher(
      context.endpointRegistry,
      context.accessRegistry,
      context.agentSelection,
      CURSOR_AGENT_ID,
    );
    return new CurrentStateDetector(
      reader,
      matcher,
      options?.logger ?? NileLogger.silent().child({ module: "cursor-current-state-detector" }),
    );
  }

  constructor(
    private readonly reader: CurrentStateReader,
    matcher: AgentStateMatcher,
    logger: NileLogger,
    ownedContext: AgentAdapterContextSession | null = null,
  ) {
    super(matcher, logger, ownedContext);
  }

  detect(): CursorDetectedCurrentState {
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

  private buildDetectedState(readResult: ReadCurrentStateResult): CursorDetectedCurrentState {
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
