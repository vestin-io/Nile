import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { EnvironmentSource } from "../../services/EnvironmentSource";
import { FileSnapshotStore } from "../../services/history/FileSnapshotStore";
import { MutationHistory } from "../../services/history/MutationHistory";
import { SecureSnapshotStore } from "../../services/history/SecureSnapshotStore";
import { NileLogger } from "../../services/NileLogger";
import { AgentApplySupport, type PreparedAgentApplySelection } from "../../actions/use/ApplySupport";
import { ApplyMutation } from "../ApplyMutation";
import type { OpenClawProjection } from "../../projection";
import {
  AgentAdapterContextSession,
  type SharedAgentAdapterContext,
} from "../../runtime-local/AgentAdapterContext";
import { OPENCLAW_AGENT_ID } from "./types";
import { OpenClawConfigStore } from "./OpenClawConfigStore";

export class ApplySelectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplySelectionValidationError";
  }
}

export class ApplySelection {
  static open(
    databasePath: string,
    options: {
      openclawHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): ApplySelection {
    const openclawHome = options?.openclawHome ?? join(homedir(), ".openclaw");
    const credentialStore = options.credentialStore;
    const environment = options.environment ?? EnvironmentSource.from(process.env);
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-apply-selection" });
    const historyRoot = join(dirname(databasePath), "history");
    const context = AgentAdapterContextSession.open(databasePath, credentialStore);

    return new ApplySelection(
      new ApplyMutation(
        new MutationHistory(
          context.database,
          new FileSnapshotStore(historyRoot),
          options?.secureSnapshotStore ?? new SecureSnapshotStore(),
          logger.child({ scope: "mutation-history" }),
        ),
        this.createApplySupport(
          context.endpointRegistry,
          context.accessRegistry,
          context.agentSelection,
          logger,
          credentialStore,
        ),
        logger,
      ),
      new OpenClawConfigStore(openclawHome),
      environment,
      context,
    );
  }

  static fromContext(
    context: SharedAgentAdapterContext,
    options: {
      openclawHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): ApplySelection {
    const openclawHome = options?.openclawHome ?? join(homedir(), ".openclaw");
    const credentialStore = options.credentialStore;
    const environment = options.environment ?? EnvironmentSource.from(process.env);
    const logger = options?.logger ?? NileLogger.silent().child({ module: "openclaw-apply-selection" });
    const historyRoot = join(dirname(context.databasePath), "history");

    return new ApplySelection(
      new ApplyMutation(
        new MutationHistory(
          context.database,
          new FileSnapshotStore(historyRoot),
          options?.secureSnapshotStore ?? new SecureSnapshotStore(),
          logger.child({ scope: "mutation-history" }),
        ),
        this.createApplySupport(
          context.endpointRegistry,
          context.accessRegistry,
          context.agentSelection,
          logger,
          credentialStore,
        ),
        logger,
      ),
      new OpenClawConfigStore(openclawHome),
      environment,
    );
  }

  constructor(
    private readonly applyMutation: ApplyMutation,
    private readonly configStore: OpenClawConfigStore,
    private readonly environment: EnvironmentSource,
    private readonly ownedContext: AgentAdapterContextSession | null = null,
  ) {}

  apply(connectionId: string) {
    const configSnapshot = this.configStore.snapshot();
    return this.applyMutation.execute({
      agentId: OPENCLAW_AGENT_ID,
      connectionId,
      historyMarkFailedEvent: "openclaw.apply.history_mark_failed",
      buildFiles: () => [
        {
          path: this.configStore.configPath,
          content: configSnapshot,
          existedBefore: configSnapshot !== null,
          isSensitive: true,
        },
      ],
      apply: (prepared) => {
        this.configStore.applyProjection(
          this.requireOpenClawProjection(prepared.projection),
          this.requireConfiguredEnvKey(prepared.credential),
        );
      },
      readAppliedFiles: () => [
        { path: this.configStore.configPath, content: this.configStore.snapshot() },
      ],
      restore: () => {
        this.configStore.restore(configSnapshot);
      },
    });
  }

  close(): void {
    this.applyMutation.close();
    this.ownedContext?.close();
  }

  private requireOpenClawProjection(
    projection: PreparedAgentApplySelection["projection"],
  ): OpenClawProjection {
    if (projection.agentId !== OPENCLAW_AGENT_ID) {
      throw new ApplySelectionValidationError(
        `Expected an openclaw projection but received ${projection.agentId}`,
      );
    }
    return projection as OpenClawProjection;
  }

  private requireConfiguredEnvKey(
    credential: PreparedAgentApplySelection["credential"],
  ): string {
    if (credential.kind !== "api_key" || credential.source !== "env_key") {
      throw new ApplySelectionValidationError(
        "OpenClaw requires an env-backed api_key credential to avoid writing secrets into config files",
      );
    }

    const envKey = credential.envKey.trim();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(envKey)) {
      throw new ApplySelectionValidationError(
        `OpenClaw env var name is invalid: ${credential.envKey}`,
      );
    }

    const apiKey = this.environment.read(envKey);
    if (!apiKey?.trim()) {
      throw new ApplySelectionValidationError(
        `OpenClaw could not read API key from env var ${envKey}`,
      );
    }

    return envKey;
  }

  private static createApplySupport(
    endpointRegistry: SharedAgentAdapterContext["endpointRegistry"],
    accessRegistry: SharedAgentAdapterContext["accessRegistry"],
    agentSelection: SharedAgentAdapterContext["agentSelection"],
    logger: NileLogger,
    credentialStore: CredentialStore,
  ): AgentApplySupport {
    return new AgentApplySupport(
      OPENCLAW_AGENT_ID,
      endpointRegistry,
      accessRegistry,
      agentSelection,
      credentialStore,
      logger,
      (message) => new ApplySelectionValidationError(message),
    );
  }
}
