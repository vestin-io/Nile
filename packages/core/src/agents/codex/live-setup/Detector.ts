import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../../services/credential/Store";
import { EnvironmentSource } from "../../../services/EnvironmentSource";
import { NileLogger } from "../../../services/NileLogger";
import { CodexAuthStore } from "../stores/CodexAuthStore";
import { CodexConfigStore } from "../stores/CodexConfigStore";
import {
  type CodexDetectedAccess,
  type CodexDetectedLiveSetup,
  type CodexDetectedEndpoint,
} from "../types";
import { CODEX_AGENT_ID } from "../types";
import { type ReadLiveSetupResult } from "./Internal";
import { AbstractAgentStateDetector } from "../../../runtime-local/AbstractAgentStateDetector";
import {
  AgentWorkspaceSession,
} from "../../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../../runtime-local/AgentWorkspaceContext";
import { LiveSetupMatcher } from "../../../actions/live-setup/Matcher";
import { LiveSetupReader } from "./Reader";

export class LiveSetupDetector extends AbstractAgentStateDetector<CodexDetectedLiveSetup> {
  static open(
    databasePath: string,
    options: {
      codexHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      logger?: NileLogger;
    },
  ): LiveSetupDetector {
    const codexHome = options?.codexHome ?? join(homedir(), ".codex");
    const credentialStore = options.credentialStore;
    const environment = options?.environment ?? EnvironmentSource.from(process.env);
    const logger = options?.logger ?? NileLogger.silent().child({ module: "codex-live-setup-detector" });
    const context = AgentWorkspaceSession.open(databasePath, credentialStore);
    const reader = new LiveSetupReader(
      new CodexAuthStore({ codexHome }),
      new CodexConfigStore(codexHome),
      environment,
    );
    const matcher = new LiveSetupMatcher(
      context.sharedContext.endpointRegistry,
      context.sharedContext.accessRegistry,
      context.agentSelection,
      CODEX_AGENT_ID,
      context.sharedContext.agentConnectionSettings,
    );
    return new LiveSetupDetector(reader, matcher, logger, context);
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      codexHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      logger?: NileLogger;
    },
  ): LiveSetupDetector {
    const codexHome = options?.codexHome ?? join(homedir(), ".codex");
    const credentialStore = options.credentialStore;
    const environment = options?.environment ?? EnvironmentSource.from(process.env);
    const logger = options?.logger ?? NileLogger.silent().child({ module: "codex-live-setup-detector" });
    const reader = new LiveSetupReader(
      new CodexAuthStore({ codexHome }),
      new CodexConfigStore(codexHome),
      environment,
    );
    const matcher = new LiveSetupMatcher(
      context.endpointRegistry,
      context.accessRegistry,
      context.agentSelection,
      CODEX_AGENT_ID,
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

  detect(): CodexDetectedLiveSetup {
    this.logger.info("codex.detect.start", {});

    const readResult = this.reader.read();
    const result = this.buildDetectedState(readResult);

    this.logger.info("codex.detect.result", {
      validity: result.validity,
      endpointFamily: result.endpoint?.endpointFamily,
      endpointIdHint: result.endpoint?.endpointIdHint,
      authMode: result.access?.authMode,
      matchedEndpointId: result.matchedConnection?.endpointId,
      matchedAccessId: result.matchedConnection?.accessId,
    });

    return result;
  }

  private buildDetectedState(readResult: ReadLiveSetupResult): CodexDetectedLiveSetup {
    if (readResult.kind === "invalid_structure") {
      return this.invalidStructure(readResult.issues);
    }
    if (readResult.kind === "invalid_semantics") {
      return this.invalidSemantics(readResult.issues, readResult.endpoint, readResult.access);
    }

    const matchResult = this.matcher.match(readResult.value);
    return {
      agentId: CODEX_AGENT_ID,
      validity: matchResult.validity,
      issues: [],
      endpoint: readResult.value.detectedEndpoint,
      access: readResult.value.detectedAccess,
      ...(readResult.value.modelId ? { modelId: readResult.value.modelId } : {}),
      matchedConnection: matchResult.matchedConnection,
    };
  }

  private invalidStructure(issues: string[]): CodexDetectedLiveSetup {
    return {
      agentId: CODEX_AGENT_ID,
      validity: "invalid_structure",
      issues,
      endpoint: null,
      access: null,
      matchedConnection: null,
    };
  }

  private invalidSemantics(
    issues: string[],
    endpoint: CodexDetectedEndpoint | null,
    access: CodexDetectedAccess | null,
  ): CodexDetectedLiveSetup {
    return {
      agentId: CODEX_AGENT_ID,
      validity: "invalid_semantics",
      issues,
      endpoint,
      access,
      matchedConnection: null,
    };
  }
}
