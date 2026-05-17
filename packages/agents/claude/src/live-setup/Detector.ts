import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import type { ClaudeDetectedAccess, ClaudeDetectedEndpoint, ClaudeDetectedLiveSetup } from "../types";
import { CLAUDE_AGENT_ID } from "../types";
import type { ReadLiveSetupResult } from "./Internal";
import { AbstractAgentStateDetector } from "@nile/core/runtime-local/AbstractAgentStateDetector";
import {
  AgentWorkspaceBinding,
} from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { LiveSetupMatcher } from "@nile/core/actions/live-setup";
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
    const binding = AgentWorkspaceBinding.open(databasePath, credentialStore);

    const reader = new LiveSetupReader(
      new ClaudeSettingsStore(claudeHome),
      new ClaudeCredentialStore(claudeHome),
    );
    return new LiveSetupDetector(
      reader,
      binding.createLiveSetupMatcher(CLAUDE_AGENT_ID),
      options?.logger ?? NileLogger.silent().child({ module: "claude-live-setup-detector" }),
      binding,
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
    const binding = AgentWorkspaceBinding.fromContext(context);
    const reader = new LiveSetupReader(
      new ClaudeSettingsStore(claudeHome),
      new ClaudeCredentialStore(claudeHome),
    );
    return new LiveSetupDetector(
      reader,
      binding.createLiveSetupMatcher(CLAUDE_AGENT_ID),
      options?.logger ?? NileLogger.silent().child({ module: "claude-live-setup-detector" }),
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
