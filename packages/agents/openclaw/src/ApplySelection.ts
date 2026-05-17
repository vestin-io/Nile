import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "@nile/core/services/credential";
import { EnvironmentSource } from "@nile/core/services/EnvironmentSource";
import { FileSnapshotStore } from "@nile/core/services/history";
import { MutationHistory } from "@nile/core/services/history";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { NileLogger } from "@nile/core/services/NileLogger";
import { JWT_PAYLOAD_DECODER } from "@nile/core/services/JwtPayloadDecoder";
import { ApplySelectionValidationError } from "@nile/core/agents/ApplySelectionValidationError";
import { AgentApplySupport, type PreparedAgentApplySelection } from "@nile/core/actions/apply";
import { ApplyMutation } from "@nile/core/agents/ApplyMutation";
import {
  AgentWorkspaceBinding,
} from "@nile/core/runtime-local/AgentWorkspaceBinding";
import type { AgentWorkspaceContext } from "@nile/core/runtime-local/AgentWorkspaceContext";
import type { StoredCredential } from "@nile/core/services/credential";
import { OPENCLAW_AGENT_ID } from "./types";
import { OPENCLAW_PROJECTION } from "./Projection";
import { OpenClawAuthProfileStore, type OpenClawAuthProfileCredential } from "./AuthProfileStore";
import { OpenClawConfigStore } from "./OpenClawConfigStore";
import type {
  OpenClawAuthProfileProjection,
  OpenClawProjection,
  OpenClawProviderProjection,
} from "./ProjectionTypes";

export { ApplySelectionValidationError };

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
    const binding = AgentWorkspaceBinding.open(databasePath, credentialStore);

    return new ApplySelection(
      new ApplyMutation(
        binding.createMutationHistory(
          options?.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.createApplySupport(
          OPENCLAW_AGENT_ID,
          credentialStore,
          logger,
          (message: string) => new ApplySelectionValidationError(message),
          OPENCLAW_PROJECTION.resolve,
        ),
        logger,
      ),
      new OpenClawConfigStore(openclawHome),
      new OpenClawAuthProfileStore(openclawHome),
      environment,
      binding,
    );
  }

  static fromContext(
    context: AgentWorkspaceContext,
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
    const binding = AgentWorkspaceBinding.fromContext(context);

    return new ApplySelection(
      new ApplyMutation(
        binding.createMutationHistory(
          options?.secureSnapshotStore,
          logger.child({ scope: "mutation-history" }),
        ),
        binding.createApplySupport(
          OPENCLAW_AGENT_ID,
          credentialStore,
          logger,
          (message: string) => new ApplySelectionValidationError(message),
          OPENCLAW_PROJECTION.resolve,
        ),
        logger,
      ),
      new OpenClawConfigStore(openclawHome),
      new OpenClawAuthProfileStore(openclawHome),
      environment,
    );
  }

  constructor(
    private readonly applyMutation: ApplyMutation,
    private readonly configStore: OpenClawConfigStore,
    private readonly authProfileStore: OpenClawAuthProfileStore,
    private readonly environment: EnvironmentSource,
    private readonly ownedContext: { close(): void } | null = null,
  ) {}

  apply(connectionId: string) {
    const configSnapshot = this.configStore.snapshot();
    const authProfileSnapshot = this.authProfileStore.snapshot();
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
        {
          path: this.authProfileStore.filePath,
          content: authProfileSnapshot,
          existedBefore: authProfileSnapshot !== null,
          isSensitive: true,
        },
      ],
      apply: (prepared) => {
        const projection = this.requireOpenClawProjection(prepared.projection);
        if (projection.configKind === "provider") {
          this.configStore.applyProviderProjection(
            projection,
            this.requireConfiguredEnvKey(prepared.credential),
          );
          return;
        }

        this.applyAuthProfileProjection(projection, prepared.credential);
      },
      readAppliedFiles: () => [
        { path: this.configStore.configPath, content: this.configStore.snapshot() },
        { path: this.authProfileStore.filePath, content: this.authProfileStore.snapshot() },
      ],
      restore: () => {
        this.configStore.restore(configSnapshot);
        this.authProfileStore.restore(authProfileSnapshot);
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

  private applyAuthProfileProjection(
    projection: OpenClawAuthProfileProjection,
    credential: PreparedAgentApplySelection["credential"],
  ): void {
    const profileId = this.configStore.profileIdForAccess(projection.providerId, projection.accessId);
    const profileCredential = this.buildAuthProfileCredential(projection, credential);
    this.configStore.applyAuthProfileProjection(projection, profileId, {
      email: this.readProfileEmail(profileCredential),
    });

    const store = this.authProfileStore.readParsedStore();
    store.profiles[profileId] = profileCredential;
    this.authProfileStore.writeStore(store);
  }

  private buildAuthProfileCredential(
    projection: OpenClawAuthProfileProjection,
    credential: PreparedAgentApplySelection["credential"],
  ): OpenClawAuthProfileCredential {
    if (projection.authMode === "openai_session" || projection.authMode === "openclaw_openai_session") {
      if (credential.kind !== "openai_session" && credential.kind !== "openclaw_openai_session") {
        throw new ApplySelectionValidationError("OpenClaw OpenAI session access requires an OpenAI session credential");
      }

      return {
        type: "oauth",
        provider: projection.providerId,
        access: credential.accessToken,
        refresh: credential.refreshToken,
        expires: this.requireOpenAiSessionExpiry(credential),
        ...(credential.accountId?.trim() ? { accountId: credential.accountId.trim() } : {}),
        ...(this.readOpenAiSessionEmail(credential)?.trim() ? { email: this.readOpenAiSessionEmail(credential) } : {}),
      };
    }

    if (projection.authMode === "claude_session") {
      if (credential.kind !== "claude_session") {
        throw new ApplySelectionValidationError("OpenClaw claude_session access requires a claude_session credential");
      }

      return {
        type: "oauth",
        provider: projection.providerId,
        access: credential.accessToken,
        refresh: credential.refreshToken,
        expires: this.requireClaudeSessionExpiry(credential),
        ...(credential.email?.trim() ? { email: credential.email.trim() } : {}),
      };
    }

    const apiKey = this.requireApiKeyValue(credential);
    if (projection.profileMode === "token") {
      return {
        type: "token",
        provider: projection.providerId,
        token: apiKey,
      };
    }

    return {
      type: "api_key",
      provider: projection.providerId,
      key: apiKey,
    };
  }

  private requireConfiguredEnvKey(
    credential: PreparedAgentApplySelection["credential"],
  ): string {
    if (credential.kind !== "api_key") {
      throw new ApplySelectionValidationError(
        "OpenClaw requires an env-backed api_key credential to avoid writing secrets into config files",
      );
    }

    const envKey = credential.envKey?.trim();
    if (!envKey) {
      throw new ApplySelectionValidationError(
        "OpenClaw requires an env-backed api_key credential to avoid writing secrets into config files",
      );
    }
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

  private requireApiKeyValue(credential: StoredCredential): string {
    if (credential.kind !== "api_key") {
      throw new ApplySelectionValidationError("OpenClaw api_key access requires an api_key credential");
    }

    if (credential.source === "env_key") {
      const envKey = credential.envKey.trim();
      if (!/^[A-Z_][A-Z0-9_]*$/.test(envKey)) {
        throw new ApplySelectionValidationError(`OpenClaw env var name is invalid: ${credential.envKey}`);
      }
      const apiKey = this.environment.read(envKey);
      if (!apiKey?.trim()) {
        throw new ApplySelectionValidationError(`OpenClaw could not read API key from env var ${envKey}`);
      }
      return apiKey.trim();
    }

    if (!credential.apiKey.trim()) {
      throw new ApplySelectionValidationError("OpenClaw api_key credential is empty");
    }
    return credential.apiKey.trim();
  }

  private requireOpenAiSessionExpiry(
    credential: Extract<PreparedAgentApplySelection["credential"], { kind: "openai_session" | "openclaw_openai_session" }>,
  ): number {
    const explicitExpiry = "expiresAt" in credential ? credential.expiresAt : undefined;
    if (typeof explicitExpiry === "number" && Number.isFinite(explicitExpiry)) {
      return explicitExpiry;
    }
    const idToken = "idToken" in credential ? credential.idToken : undefined;
    const expiry = (idToken ? this.readJwtExpiryMs(idToken) : null) ?? this.readJwtExpiryMs(credential.accessToken);
    if (expiry) {
      return expiry;
    }
    throw new ApplySelectionValidationError("OpenClaw could not determine an expiry for the OpenAI session credential");
  }

  private requireClaudeSessionExpiry(
    credential: Extract<PreparedAgentApplySelection["credential"], { kind: "claude_session" }>,
  ): number {
    if (typeof credential.expiresAt === "number" && Number.isFinite(credential.expiresAt)) {
      return credential.expiresAt;
    }
    const expiry = this.readJwtExpiryMs(credential.accessToken);
    if (expiry) {
      return expiry;
    }
    throw new ApplySelectionValidationError("OpenClaw could not determine an expiry for the Claude session credential");
  }

  private readOpenAiSessionEmail(
    credential: Extract<PreparedAgentApplySelection["credential"], { kind: "openai_session" | "openclaw_openai_session" }>,
  ): string | undefined {
    if ("email" in credential && credential.email?.trim()) {
      return credential.email.trim();
    }
    if (!("idToken" in credential)) {
      return undefined;
    }
    const claims = this.decodeJwtPayload(credential.idToken);
    const email = claims?.email;
    return typeof email === "string" && email.trim() ? email.trim() : undefined;
  }

  private readProfileEmail(credential: OpenClawAuthProfileCredential): string | undefined {
    return credential.email?.trim() || undefined;
  }

  private readJwtExpiryMs(token: string): number | null {
    const claims = this.decodeJwtPayload(token);
    const exp = claims?.exp;
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    return JWT_PAYLOAD_DECODER.decode(token);
  }
}
