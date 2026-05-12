import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../../services/credential/Store";
import { NileLogger } from "../../../services/NileLogger";
import type { ClaudeDetectedAccess, ClaudeDetectedEndpoint, ClaudeDetectedLiveSetup } from "../types";
import { CLAUDE_AGENT_ID } from "../types";
import type { ReadLiveSetupResult } from "./Internal";
import { AbstractAgentStateDetector } from "../../../runtime-local/AbstractAgentStateDetector";
import {
  AgentWorkspaceSession,
} from "../../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../../runtime-local/AgentWorkspaceContext";
import { LiveSetupMatcher } from "../../../actions/live-setup/Matcher";
import { LiveSetupReader } from "./Reader";
import { ClaudeCredentialStore } from "../Store";
import { ClaudeSettingsStore } from "../SettingsStore";

export class LiveSetupDetector extends AbstractAgentStateDetector<ClaudeDetectedLiveSetup> {
  static open(
    databasePath: string,
    options: {
      claudeHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): LiveSetupDetector {
    const claudeHome = options?.claudeHome ?? join(homedir(), ".claude");
    const credentialStore = options.credentialStore;
    const context = AgentWorkspaceSession.open(databasePath, credentialStore);

    const reader = new LiveSetupReader(
      new ClaudeSettingsStore(claudeHome),
      new ClaudeCredentialStore(claudeHome),
    );
    const matcher = new LiveSetupMatcher(
      context.sharedContext.endpointRegistry,
      context.sharedContext.accessRegistry,
      context.agentSelection,
      CLAUDE_AGENT_ID,
      context.sharedContext.agentConnectionSettings,
    );
    return new LiveSetupDetector(
      reader,
      matcher,
      options?.logger ?? NileLogger.silent().child({ module: "claude-live-setup-detector" }),
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
  ): LiveSetupDetector {
    const claudeHome = options?.claudeHome ?? join(homedir(), ".claude");
    const credentialStore = options.credentialStore;
    const reader = new LiveSetupReader(
      new ClaudeSettingsStore(claudeHome),
      new ClaudeCredentialStore(claudeHome),
    );
    const matcher = new LiveSetupMatcher(
      context.endpointRegistry,
      context.accessRegistry,
      context.agentSelection,
      CLAUDE_AGENT_ID,
      context.agentConnectionSettings,
    );
    return new LiveSetupDetector(
      reader,
      matcher,
      options?.logger ?? NileLogger.silent().child({ module: "claude-live-setup-detector" }),
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

  detect(): ClaudeDetectedLiveSetup {
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

  private buildDetectedState(readResult: ReadLiveSetupResult): ClaudeDetectedLiveSetup {
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
      ...(readResult.value.modelId ? { modelId: readResult.value.modelId } : {}),
      matchedConnection: matchResult.matchedConnection,
    };
  }
}
