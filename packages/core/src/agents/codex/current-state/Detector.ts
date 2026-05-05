import { homedir } from "node:os";
import { join } from "node:path";

import type { CredentialStore } from "../../../services/credential/Store";
import { EnvironmentSource } from "../../../services/EnvironmentSource";
import { NileLogger } from "../../../services/NileLogger";
import { CodexAuthStore } from "../stores/CodexAuthStore";
import { CodexConfigStore } from "../stores/CodexConfigStore";
import {
  type CodexDetectedCurrentState,
  type CodexDetectedAccess,
  type CodexDetectedEndpoint,
} from "../types";
import { CODEX_AGENT_ID } from "../types";
import { type ReadCurrentStateResult } from "./Internal";
import { AbstractAgentStateDetector } from "../../../runtime-local/AbstractAgentStateDetector";
import {
  AgentAdapterContextSession,
  type SharedAgentAdapterContext,
} from "../../../runtime-local/AgentAdapterContext";
import { AgentStateMatcher } from "../../../actions/import/StateMatcher";
import { CurrentStateReader } from "./Reader";

export class CurrentStateDetector extends AbstractAgentStateDetector<CodexDetectedCurrentState> {
  static open(
    databasePath: string,
    options: {
      codexHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      logger?: NileLogger;
    },
  ): CurrentStateDetector {
    const codexHome = options?.codexHome ?? join(homedir(), ".codex");
    const credentialStore = options.credentialStore;
    const environment = options?.environment ?? EnvironmentSource.from(process.env);
    const logger = options?.logger ?? NileLogger.silent().child({ module: "codex-current-state-detector" });
    const context = AgentAdapterContextSession.open(databasePath, credentialStore);
    const reader = new CurrentStateReader(
      new CodexAuthStore({ codexHome }),
      new CodexConfigStore(codexHome),
      environment,
    );
    const matcher = new AgentStateMatcher(
      context.sharedContext.endpointRegistry,
      context.sharedContext.accessRegistry,
      context.agentSelection,
      CODEX_AGENT_ID,
    );
    return new CurrentStateDetector(reader, matcher, logger, context);
  }

  static fromContext(
    context: SharedAgentAdapterContext,
    options: {
      codexHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      logger?: NileLogger;
    },
  ): CurrentStateDetector {
    const codexHome = options?.codexHome ?? join(homedir(), ".codex");
    const credentialStore = options.credentialStore;
    const environment = options?.environment ?? EnvironmentSource.from(process.env);
    const logger = options?.logger ?? NileLogger.silent().child({ module: "codex-current-state-detector" });
    const reader = new CurrentStateReader(
      new CodexAuthStore({ codexHome }),
      new CodexConfigStore(codexHome),
      environment,
    );
    const matcher = new AgentStateMatcher(
      context.endpointRegistry,
      context.accessRegistry,
      context.agentSelection,
      CODEX_AGENT_ID,
    );
    return new CurrentStateDetector(reader, matcher, logger);
  }

  constructor(
    private readonly reader: CurrentStateReader,
    matcher: AgentStateMatcher,
    logger: NileLogger,
    ownedContext: AgentAdapterContextSession | null = null,
  ) {
    super(matcher, logger, ownedContext);
  }

  detect(): CodexDetectedCurrentState {
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

  private buildDetectedState(readResult: ReadCurrentStateResult): CodexDetectedCurrentState {
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
      matchedConnection: matchResult.matchedConnection,
    };
  }

  private invalidStructure(issues: string[]): CodexDetectedCurrentState {
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
  ): CodexDetectedCurrentState {
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
