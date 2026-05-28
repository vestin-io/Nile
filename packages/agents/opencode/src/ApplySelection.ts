import { homedir } from "node:os";
import { join } from "node:path";

import { ApplySelectionValidationError } from "@nile/core/agents/ApplySelectionValidationError";
import { ApplyMutation } from "@nile/core/agents/ApplyMutation";
import type { PreparedAgentApplySelection } from "@nile/core/actions/apply";
import type { CredentialStore } from "@nile/core/services/credential";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { NileLogger } from "@nile/core/services/NileLogger";
import { JWT_PAYLOAD_DECODER } from "@nile/core/services/JwtPayloadDecoder";
import { AgentWorkspaceBinding } from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import { OpenCodeAuthStore } from "./OpenCodeAuthStore";
import { OpenCodeConfigStore } from "./OpenCodeConfigStore";
import { OPENCODE_PROJECTION } from "./Projection";
import type { OpenCodeProjection } from "./ProjectionTypes";
import { OPENCODE_AGENT_ID } from "./types";

export { ApplySelectionValidationError };

export class ApplySelection {
  static open(
    databasePath: string,
    options: {
      opencodeHome?: string;
      opencodeDataHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): ApplySelection {
    const opencodeHome = options.opencodeHome ?? join(homedir(), ".config", "opencode");
    const opencodeDataHome = options.opencodeDataHome ?? join(homedir(), ".local", "share", "opencode");
    const credentialStore = options.credentialStore;
    const environment = options.environment ?? EnvironmentSource.from(process.env);
    const logger = options.logger ?? NileLogger.silent().child({ module: "opencode-apply-selection" });
    const binding = AgentWorkspaceBinding.open(databasePath, credentialStore);

    return new ApplySelection(
      new ApplyMutation(
        binding.createMutationHistory(
          options.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.createApplySupport(
          OPENCODE_AGENT_ID,
          credentialStore,
          logger,
          (message: string) => new ApplySelectionValidationError(message),
          OPENCODE_PROJECTION.resolve,
        ),
        logger,
      ),
      new OpenCodeConfigStore(opencodeHome),
      new OpenCodeAuthStore(opencodeDataHome),
      environment,
      binding,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
    options: {
      opencodeHome?: string;
      opencodeDataHome?: string;
      credentialStore: CredentialStore;
      environment?: EnvironmentSource;
      secureSnapshotStore?: SecureSnapshotStore;
      logger?: NileLogger;
    },
  ): ApplySelection {
    const opencodeHome = options.opencodeHome ?? join(homedir(), ".config", "opencode");
    const opencodeDataHome = options.opencodeDataHome ?? join(homedir(), ".local", "share", "opencode");
    const credentialStore = options.credentialStore;
    const environment = options.environment ?? EnvironmentSource.from(process.env);
    const logger = options.logger ?? NileLogger.silent().child({ module: "opencode-apply-selection" });
    const binding = AgentWorkspaceBinding.fromContext(context);

    return new ApplySelection(
      new ApplyMutation(
        binding.createMutationHistory(
          options.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.createApplySupport(
          OPENCODE_AGENT_ID,
          credentialStore,
          logger,
          (message: string) => new ApplySelectionValidationError(message),
          OPENCODE_PROJECTION.resolve,
        ),
        logger,
      ),
      new OpenCodeConfigStore(opencodeHome),
      new OpenCodeAuthStore(opencodeDataHome),
      environment,
    );
  }

  constructor(
    private readonly applyMutation: ApplyMutation,
    private readonly configStore: OpenCodeConfigStore,
    private readonly authStore: OpenCodeAuthStore,
    private readonly environment: EnvironmentSource,
    private readonly ownedContext: { close(): void } | null = null,
  ) {}

  apply(connectionId: string) {
    const configSnapshot = this.configStore.snapshot();
    const authSnapshot = this.authStore.snapshot();
    return this.applyMutation.execute({
      agentId: OPENCODE_AGENT_ID,
      connectionId,
      historyMarkFailedEvent: "opencode.apply.history_mark_failed",
      buildFiles: () => [
        {
          path: this.configStore.configPath,
          content: configSnapshot,
          existedBefore: configSnapshot !== null,
          isSensitive: true,
        },
        {
          path: this.authStore.authPath,
          content: authSnapshot,
          existedBefore: authSnapshot !== null,
          isSensitive: true,
        },
      ],
      apply: (prepared) => {
        const projection = this.requireOpenCodeProjection(prepared.projection);
        if (projection.authMode === "openai_session") {
          this.configStore.applyProjection(projection);
          this.authStore.writeOauthCredential("openai", this.buildOpenAiOauthCredential(prepared.credential));
          return;
        }

        this.configStore.applyProjection(projection, this.requireConfiguredEnvKey(prepared.credential));
      },
      readAppliedFiles: () => [
        { path: this.configStore.configPath, content: this.configStore.snapshot() },
        { path: this.authStore.authPath, content: this.authStore.snapshot() },
      ],
      restore: () => {
        this.configStore.restore(configSnapshot);
        this.authStore.restore(authSnapshot);
      },
    });
  }

  close(): void {
    this.applyMutation.close();
    this.ownedContext?.close();
  }

  private requireOpenCodeProjection(
    projection: PreparedAgentApplySelection["projection"],
  ): OpenCodeProjection {
    if (projection.agentId !== OPENCODE_AGENT_ID) {
      throw new ApplySelectionValidationError(
        `Expected an opencode projection but received ${projection.agentId}`,
      );
    }
    return projection as OpenCodeProjection;
  }

  private requireConfiguredEnvKey(
    credential: PreparedAgentApplySelection["credential"],
  ): string {
    if (credential.kind !== "api_key") {
      throw new ApplySelectionValidationError(
        "OpenCode requires an env-backed api_key credential to avoid writing secrets into config files",
      );
    }

    const envKey = credential.envKey?.trim();
    if (!envKey) {
      throw new ApplySelectionValidationError(
        "OpenCode requires an env-backed api_key credential to avoid writing secrets into config files",
      );
    }
    if (!/^[A-Z_][A-Z0-9_]*$/.test(envKey)) {
      throw new ApplySelectionValidationError(`OpenCode env var name is invalid: ${credential.envKey}`);
    }

    const apiKey = this.environment.read(envKey);
    if (!apiKey?.trim()) {
      throw new ApplySelectionValidationError(`OpenCode could not read API key from env var ${envKey}`);
    }

    return envKey;
  }

  private buildOpenAiOauthCredential(
    credential: PreparedAgentApplySelection["credential"],
  ): {
    type: "oauth";
    access: string;
    refresh: string;
    expires: number;
    accountId?: string;
  } {
    if (credential.kind !== "openai_session") {
      throw new ApplySelectionValidationError("OpenCode openai_session access requires an openai_session credential");
    }

    return {
      type: "oauth",
      access: credential.accessToken,
      refresh: credential.refreshToken,
      expires: this.requireOpenAiSessionExpiry(credential),
      ...(credential.accountId?.trim() ? { accountId: credential.accountId.trim() } : {}),
    };
  }

  private requireOpenAiSessionExpiry(
    credential: Extract<PreparedAgentApplySelection["credential"], { kind: "openai_session" }>,
  ): number {
    const expiry = this.readJwtExpiryMs(credential.idToken) ?? this.readJwtExpiryMs(credential.accessToken);
    if (expiry) {
      return expiry;
    }
    throw new ApplySelectionValidationError("OpenCode could not determine an expiry for the OpenAI session credential");
  }

  private readJwtExpiryMs(token: string): number | null {
    const claims = JWT_PAYLOAD_DECODER.decode(token);
    const exp = claims?.exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
  }
}
