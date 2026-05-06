import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../../services/credential/Store";
import { NileLogger } from "../../../services/NileLogger";
import { AbstractAgentStateDetector } from "../../../runtime-local/AbstractAgentStateDetector";
import {
  AgentWorkspaceSession,
} from "../../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../../runtime-local/AgentWorkspaceContext";
import { CurrentStateMatcher } from "../../../actions/current-state/Matcher";
import { OpenClawConfigStore } from "../OpenClawConfigStore";
import { OPENCLAW_AGENT_ID, type OpenClawDetectedAccess, type OpenClawDetectedCurrentState, type OpenClawDetectedEndpoint } from "../types";
import type { ReadCurrentStateResult } from "./Internal";
import { CurrentStateReader } from "./Reader";

export class CurrentStateDetector extends AbstractAgentStateDetector<OpenClawDetectedCurrentState> {
  static open(
    databasePath: string,
    options: {
      openclawHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): CurrentStateDetector {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-current-state-detector" });
    const context = AgentWorkspaceSession.open(databasePath, options.credentialStore);
    const reader = new CurrentStateReader(
      new OpenClawConfigStore(options?.openclawHome ?? join(homedir(), ".openclaw")),
    );
    const matcher = new CurrentStateMatcher(
      context.sharedContext.endpointRegistry,
      context.sharedContext.accessRegistry,
      context.agentSelection,
      OPENCLAW_AGENT_ID,
    );
    return new CurrentStateDetector(reader, matcher, logger, context);
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      openclawHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): CurrentStateDetector {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-current-state-detector" });
    const reader = new CurrentStateReader(
      new OpenClawConfigStore(options?.openclawHome ?? join(homedir(), ".openclaw")),
    );
    const matcher = new CurrentStateMatcher(
      context.endpointRegistry,
      context.accessRegistry,
      context.agentSelection,
      OPENCLAW_AGENT_ID,
    );
    return new CurrentStateDetector(reader, matcher, logger);
  }

  constructor(
    private readonly reader: CurrentStateReader,
    matcher: CurrentStateMatcher,
    logger: NileLogger,
    ownedContext: AgentWorkspaceSession | null = null,
  ) {
    super(matcher, logger, ownedContext);
  }

  detect(): OpenClawDetectedCurrentState {
    this.logger.info("openclaw.detect.start", {});
    const readResult = this.reader.read();
    const result = this.buildDetectedState(readResult);
    this.logger.info("openclaw.detect.result", {
      validity: result.validity,
      endpointFamily: result.endpoint?.endpointFamily,
      endpointIdHint: result.endpoint?.endpointIdHint,
      authMode: result.access?.authMode,
      openclawModelId: result.access?.openclawModelId,
      matchedEndpointId: result.matchedConnection?.endpointId,
      matchedAccessId: result.matchedConnection?.accessId,
    });
    return result;
  }

  private buildDetectedState(readResult: ReadCurrentStateResult): OpenClawDetectedCurrentState {
    if (readResult.kind === "invalid_structure") {
      return this.invalidStructure(readResult.issues);
    }
    if (readResult.kind === "invalid_semantics") {
      return this.invalidSemantics(readResult.issues, readResult.endpoint, readResult.access);
    }

    const matchResult = this.matcher.match(readResult.value);
    return {
      agentId: OPENCLAW_AGENT_ID,
      validity: matchResult.validity,
      issues: [],
      endpoint: readResult.value.detectedEndpoint,
      access: readResult.value.detectedAccess,
      matchedConnection: matchResult.matchedConnection,
    };
  }

  private invalidStructure(issues: string[]): OpenClawDetectedCurrentState {
    return {
      agentId: OPENCLAW_AGENT_ID,
      validity: "invalid_structure",
      issues,
      endpoint: null,
      access: null,
      matchedConnection: null,
    };
  }

  private invalidSemantics(
    issues: string[],
    endpoint: OpenClawDetectedEndpoint | null,
    access: OpenClawDetectedAccess | null,
  ): OpenClawDetectedCurrentState {
    return {
      agentId: OPENCLAW_AGENT_ID,
      validity: "invalid_semantics",
      issues,
      endpoint,
      access,
      matchedConnection: null,
    };
  }
}
