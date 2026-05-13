import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../../services/credential/Store";
import { NileLogger } from "../../../services/NileLogger";
import { AbstractAgentStateDetector } from "../../../runtime-local/AbstractAgentStateDetector";
import {
  AgentWorkspaceSession,
} from "../../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../../runtime-local/AgentWorkspaceContext";
import { LiveSetupMatcher } from "../../../actions/live-setup/Matcher";
import { OpenClawAuthProfileStore } from "../AuthProfileStore";
import { OpenClawConfigStore } from "../OpenClawConfigStore";
import { OPENCLAW_AGENT_ID, type OpenClawDetectedAccess, type OpenClawDetectedEndpoint, type OpenClawDetectedLiveSetup } from "../types";
import type { ReadLiveSetupResult } from "./Internal";
import { LiveSetupReader } from "./Reader";

export class LiveSetupDetector extends AbstractAgentStateDetector<OpenClawDetectedLiveSetup> {
  static open(
    databasePath: string,
    options: {
      openclawHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): LiveSetupDetector {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-live-setup-detector" });
    const context = AgentWorkspaceSession.open(databasePath, options.credentialStore);
    const openclawHome = options?.openclawHome ?? join(homedir(), ".openclaw");
    const reader = new LiveSetupReader(
      new OpenClawConfigStore(openclawHome),
      new OpenClawAuthProfileStore(openclawHome),
    );
    const matcher = new LiveSetupMatcher(
      context.sharedContext.endpointRegistry,
      context.sharedContext.accessRegistry,
      context.agentSelection,
      OPENCLAW_AGENT_ID,
      context.sharedContext.agentConnectionSettings,
    );
    return new LiveSetupDetector(reader, matcher, logger, context);
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      openclawHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): LiveSetupDetector {
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-live-setup-detector" });
    const openclawHome = options?.openclawHome ?? join(homedir(), ".openclaw");
    const reader = new LiveSetupReader(
      new OpenClawConfigStore(openclawHome),
      new OpenClawAuthProfileStore(openclawHome),
    );
    const matcher = new LiveSetupMatcher(
      context.endpointRegistry,
      context.accessRegistry,
      context.agentSelection,
      OPENCLAW_AGENT_ID,
      context.agentConnectionSettings,
    );
    return new LiveSetupDetector(reader, matcher, logger);
  }

  constructor(
    private readonly reader: LiveSetupReader,
    matcher: LiveSetupMatcher,
    logger: NileLogger,
    ownedContext: AgentWorkspaceSession | null = null,
  ) {
    super(matcher, logger, ownedContext);
  }

  detect(): OpenClawDetectedLiveSetup {
    this.logger.info("openclaw.detect.start", {});
    const readResult = this.reader.read();
    const result = this.buildDetectedState(readResult);
    this.logger.info("openclaw.detect.result", {
      validity: result.validity,
      endpointFamily: result.endpoint?.endpointFamily,
      endpointIdHint: result.endpoint?.endpointIdHint,
      authMode: result.access?.authMode,
      modelId: result.modelId,
      matchedEndpointId: result.matchedConnection?.endpointId,
      matchedAccessId: result.matchedConnection?.accessId,
    });
    return result;
  }

  private buildDetectedState(readResult: ReadLiveSetupResult): OpenClawDetectedLiveSetup {
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
      modelId: readResult.value.modelId,
      matchedConnection: matchResult.matchedConnection,
    };
  }

  private invalidStructure(issues: string[]): OpenClawDetectedLiveSetup {
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
  ): OpenClawDetectedLiveSetup {
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
