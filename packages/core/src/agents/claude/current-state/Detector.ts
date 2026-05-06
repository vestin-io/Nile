import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../../services/credential/Store";
import { NileLogger } from "../../../services/NileLogger";
import type { ClaudeDetectedAccess, ClaudeDetectedCurrentState, ClaudeDetectedEndpoint } from "../types";
import { CLAUDE_AGENT_ID } from "../types";
import type { ReadCurrentStateResult } from "./Internal";
import { AbstractAgentStateDetector } from "../../../runtime-local/AbstractAgentStateDetector";
import {
  AgentWorkspaceSession,
} from "../../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../../runtime-local/AgentWorkspaceContext";
import { CurrentStateMatcher } from "../../../actions/current-state/Matcher";
import { CurrentStateReader } from "./Reader";
import { ClaudeCredentialStore } from "../Store";
import { ClaudeSettingsStore } from "../SettingsStore";

export class CurrentStateDetector extends AbstractAgentStateDetector<ClaudeDetectedCurrentState> {
  static open(
    databasePath: string,
    options: {
      claudeHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): CurrentStateDetector {
    const claudeHome = options?.claudeHome ?? join(homedir(), ".claude");
    const credentialStore = options.credentialStore;
    const context = AgentWorkspaceSession.open(databasePath, credentialStore);

    const reader = new CurrentStateReader(
      new ClaudeSettingsStore(claudeHome),
      new ClaudeCredentialStore(claudeHome),
    );
    const matcher = new CurrentStateMatcher(
      context.sharedContext.endpointRegistry,
      context.sharedContext.accessRegistry,
      context.agentSelection,
      CLAUDE_AGENT_ID,
    );
    return new CurrentStateDetector(
      reader,
      matcher,
      options?.logger ?? NileLogger.silent().child({ module: "claude-current-state-detector" }),
      context,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      claudeHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): CurrentStateDetector {
    const claudeHome = options?.claudeHome ?? join(homedir(), ".claude");
    const credentialStore = options.credentialStore;
    const reader = new CurrentStateReader(
      new ClaudeSettingsStore(claudeHome),
      new ClaudeCredentialStore(claudeHome),
    );
    const matcher = new CurrentStateMatcher(
      context.endpointRegistry,
      context.accessRegistry,
      context.agentSelection,
      CLAUDE_AGENT_ID,
    );
    return new CurrentStateDetector(
      reader,
      matcher,
      options?.logger ?? NileLogger.silent().child({ module: "claude-current-state-detector" }),
    );
  }

  constructor(
    private readonly reader: CurrentStateReader,
    matcher: CurrentStateMatcher,
    logger: NileLogger,
    ownedContext: AgentWorkspaceSession | null = null,
  ) {
    super(matcher, logger, ownedContext);
  }

  detect(): ClaudeDetectedCurrentState {
    this.logger.info("claude.detect.start", {});

    const readResult = this.reader.read();
    const result = this.buildDetectedState(readResult);

    this.logger.info("claude.detect.result", {
      validity: result.validity,
      endpointFamily: result.endpoint?.endpointFamily,
      endpointIdHint: result.endpoint?.endpointIdHint,
      authMode: result.access?.authMode,
      matchedEndpointId: result.matchedConnection?.endpointId,
      matchedAccessId: result.matchedConnection?.accessId,
    });

    return result;
  }

  private buildDetectedState(readResult: ReadCurrentStateResult): ClaudeDetectedCurrentState {
    if (readResult.kind === "invalid_structure") {
      return {
        agentId: CLAUDE_AGENT_ID,
        validity: "invalid_structure",
        issues: readResult.issues,
        endpoint: null,
        access: null,
        matchedConnection: null,
      };
    }

    if (readResult.kind === "invalid_semantics") {
      return {
        agentId: CLAUDE_AGENT_ID,
        validity: "invalid_semantics",
        issues: readResult.issues,
        endpoint: readResult.endpoint,
        access: readResult.access,
        matchedConnection: null,
      };
    }

    const matchResult = this.matcher.match(readResult.value);
    return {
      agentId: CLAUDE_AGENT_ID,
      validity: matchResult.validity,
      issues: [],
      endpoint: readResult.value.detectedEndpoint as ClaudeDetectedEndpoint,
      access: readResult.value.detectedAccess as ClaudeDetectedAccess,
      matchedConnection: matchResult.matchedConnection,
    };
  }
}
