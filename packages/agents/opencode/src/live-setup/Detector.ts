import { homedir } from "node:os";
import { join } from "node:path";

import { LiveSetupMatcher } from "@nile/core/actions/live-setup";
import type { CredentialStore } from "@nile/core/services/credential";
import { NileLogger } from "@nile/core/services/NileLogger";
import { AbstractAgentStateDetector } from "@nile/core/runtime-local/AbstractAgentStateDetector";
import { AgentWorkspaceBinding } from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { OpenCodeAuthStore } from "../OpenCodeAuthStore";
import { OpenCodeConfigStore } from "../OpenCodeConfigStore";
import type { OpenCodeDetectedAccess, OpenCodeDetectedEndpoint, OpenCodeDetectedLiveSetup } from "../types";
import { OPENCODE_AGENT_ID } from "../types";
import type { ReadLiveSetupResult } from "./Internal";
import { LiveSetupReader } from "./Reader";

export class LiveSetupDetector extends AbstractAgentStateDetector<OpenCodeDetectedLiveSetup> {
  static open(
    databasePath: string,
    options: {
      opencodeHome?: string;
      opencodeDataHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): LiveSetupDetector {
    const logger = options.logger ?? NileLogger.silent().child({ module: "opencode-live-setup-detector" });
    const binding = AgentWorkspaceBinding.open(databasePath, options.credentialStore);
    const opencodeHome = options.opencodeHome ?? join(homedir(), ".config", "opencode");
    const opencodeDataHome = options.opencodeDataHome ?? join(homedir(), ".local", "share", "opencode");
    const reader = new LiveSetupReader(
      new OpenCodeConfigStore(opencodeHome),
      new OpenCodeAuthStore(opencodeDataHome),
    );
    return new LiveSetupDetector(reader, binding.createLiveSetupMatcher(OPENCODE_AGENT_ID), logger, binding);
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      opencodeHome?: string;
      opencodeDataHome?: string;
      credentialStore: CredentialStore;
      logger?: NileLogger;
    },
  ): LiveSetupDetector {
    const logger = options.logger ?? NileLogger.silent().child({ module: "opencode-live-setup-detector" });
    const opencodeHome = options.opencodeHome ?? join(homedir(), ".config", "opencode");
    const opencodeDataHome = options.opencodeDataHome ?? join(homedir(), ".local", "share", "opencode");
    const binding = AgentWorkspaceBinding.fromContext(context);
    const reader = new LiveSetupReader(
      new OpenCodeConfigStore(opencodeHome),
      new OpenCodeAuthStore(opencodeDataHome),
    );
    return new LiveSetupDetector(reader, binding.createLiveSetupMatcher(OPENCODE_AGENT_ID), logger);
  }

  constructor(
    private readonly reader: LiveSetupReader,
    matcher: LiveSetupMatcher,
    logger: NileLogger,
    ownedContext: { close(): void } | null = null,
  ) {
    super(matcher, logger, ownedContext);
  }

  detect(): OpenCodeDetectedLiveSetup {
    this.logger.info("opencode.detect.start", {});
    const readResult = this.reader.read();
    const result = this.buildDetectedState(readResult);
    this.logger.info("opencode.detect.result", {
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

  private buildDetectedState(readResult: ReadLiveSetupResult): OpenCodeDetectedLiveSetup {
    if (readResult.kind === "invalid_structure") {
      return this.invalidStructure(readResult.issues);
    }
    if (readResult.kind === "invalid_semantics") {
      return this.invalidSemantics(readResult.issues, readResult.endpoint, readResult.access);
    }

    const matchResult = this.matcher.match(readResult.value);
    return {
      agentId: OPENCODE_AGENT_ID,
      validity: matchResult.validity,
      issues: [],
      endpoint: readResult.value.detectedEndpoint,
      access: readResult.value.detectedAccess,
      modelId: readResult.value.modelId,
      matchedConnection: matchResult.matchedConnection,
    };
  }

  private invalidStructure(issues: string[]): OpenCodeDetectedLiveSetup {
    return {
      agentId: OPENCODE_AGENT_ID,
      validity: "invalid_structure",
      issues,
      endpoint: null,
      access: null,
      matchedConnection: null,
    };
  }

  private invalidSemantics(
    issues: string[],
    endpoint: OpenCodeDetectedEndpoint | null,
    access: OpenCodeDetectedAccess | null,
  ): OpenCodeDetectedLiveSetup {
    return {
      agentId: OPENCODE_AGENT_ID,
      validity: "invalid_semantics",
      issues,
      endpoint,
      access,
      matchedConnection: null,
    };
  }
}
