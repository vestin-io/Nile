import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { AbstractAgentStateDetector } from "@nile/core/runtime-local/AbstractAgentStateDetector";
import { AgentWorkspaceBinding } from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { LiveSetupMatcher } from "@nile/core/actions/live-setup";
import { GeminiSessionStores } from "../Stores";
import type { GeminiDetectedAccess, GeminiDetectedEndpoint, GeminiDetectedLiveSetup } from "../types";
import { GEMINI_AGENT_ID } from "../types";
import type { ReadLiveSetupResult } from "./Internal";
import { LiveSetupReader } from "./Reader";

export class LiveSetupDetector extends AbstractAgentStateDetector<GeminiDetectedLiveSetup> {
  static open(
    databasePath: string,
    options: {
      geminiHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): LiveSetupDetector {
    const geminiHome = options.geminiHome ?? join(homedir(), ".gemini");
    const binding = AgentWorkspaceBinding.open(databasePath, options.credentialStore);
    const reader = createLiveSetupReader(geminiHome);
    return new LiveSetupDetector(
      reader,
      binding.createLiveSetupMatcher(GEMINI_AGENT_ID),
      options.logger ?? NileLogger.silent().child({ module: "gemini-live-setup-detector" }),
      binding,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      geminiHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): LiveSetupDetector {
    const geminiHome = options.geminiHome ?? join(homedir(), ".gemini");
    const reader = createLiveSetupReader(geminiHome);
    const binding = AgentWorkspaceBinding.fromContext(context);
    return new LiveSetupDetector(
      reader,
      binding.createLiveSetupMatcher(GEMINI_AGENT_ID),
      options.logger ?? NileLogger.silent().child({ module: "gemini-live-setup-detector" }),
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

  detect(): GeminiDetectedLiveSetup {
    this.logger.info("gemini.detect.start", {});

    const readResult = this.reader.read();
    const result = this.buildDetectedState(readResult);

    this.logger.info("gemini.detect.result", {
      validity: result.validity,
      endpointFamily: result.endpoint?.endpointFamily,
      endpointIdHint: result.endpoint?.endpointIdHint,
      authMode: result.access?.authMode,
      matchedEndpointId: result.matchedConnection?.endpointId,
      matchedAccessId: result.matchedConnection?.accessId,
    });

    return result;
  }

  private buildDetectedState(readResult: ReadLiveSetupResult): GeminiDetectedLiveSetup {
    if (readResult.kind === "invalid_structure") {
      return {
        agentId: GEMINI_AGENT_ID,
        validity: "invalid_structure",
        issues: readResult.issues,
        endpoint: null,
        access: null,
        matchedConnection: null,
      };
    }

    if (readResult.kind === "invalid_semantics") {
      return {
        agentId: GEMINI_AGENT_ID,
        validity: "invalid_semantics",
        issues: readResult.issues,
        endpoint: null,
        access: null,
        matchedConnection: null,
      };
    }

    const matchResult = this.matcher.match(readResult.value);
    return {
      agentId: GEMINI_AGENT_ID,
      validity: matchResult.validity,
      issues: [],
      endpoint: readResult.value.detectedEndpoint as GeminiDetectedEndpoint,
      access: readResult.value.detectedAccess as GeminiDetectedAccess,
      matchedConnection: matchResult.matchedConnection,
    };
  }
}

function createLiveSetupReader(geminiHome: string): LiveSetupReader {
  return new LiveSetupReader(GeminiSessionStores.open(geminiHome).reader);
}
