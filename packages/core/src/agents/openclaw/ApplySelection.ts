import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { CredentialStore } from "../../services/credential/Store";
import { EnvironmentSource } from "../../services/EnvironmentSource";
import { FileSnapshotStore } from "../../services/history/FileSnapshotStore";
import { MutationHistory } from "../../services/history/MutationHistory";
import { SecureSnapshotStore } from "../../services/history/SecureSnapshotStore";
import { NileLogger } from "../../services/NileLogger";
import { AgentApplySupport, type PreparedAgentApplySelection } from "../../actions/apply/Support";
import { ApplyMutation } from "../ApplyMutation";
import type { OpenClawAuthProfileProjection, OpenClawProjection, OpenClawProviderProjection } from "../../projection";
import {
  AgentWorkspaceSession,
} from "../../runtime-local/AgentWorkspaceSession";
import type { AgentWorkspaceContext } from "../../runtime-local/AgentWorkspaceContext";
import type { StoredCredential } from "../../services/credential/Types";
import { OPENCLAW_AGENT_ID } from "./types";
import { OpenClawAuthProfileStore, type OpenClawAuthProfileCredential } from "./AuthProfileStore";
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
    const context = AgentWorkspaceSession.open(databasePath, credentialStore);

    return new ApplySelection(
      new ApplyMutation(
        new MutationHistory(
          context.workspaceState.database,
          new FileSnapshotStore(historyRoot),
          options?.secureSnapshotStore ?? new SecureSnapshotStore(),
          logger.child({ scope: "mutation-history" }),
        ),
        this.createApplySupport(
          context.sharedContext.endpointRegistry,
          context.sharedContext.accessRegistry,
          context.agentSelection,
          context.sharedContext.agentConnectionSettings,
          logger,
          credentialStore,
        ),
        logger,
      ),
      new OpenClawConfigStore(openclawHome),
      new OpenClawAuthProfileStore(openclawHome),
      environment,
      context,
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
          context.agentConnectionSettings,
          logger,
          credentialStore,
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
    private readonly ownedContext: AgentWorkspaceSession | null = null,
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
    if (projection.authMode === "openai_session") {
      if (credential.kind !== "openai_session") {
        throw new ApplySelectionValidationError("OpenClaw openai_session access requires an openai_session credential");
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
    credential: Extract<PreparedAgentApplySelection["credential"], { kind: "openai_session" }>,
  ): number {
    const expiry = this.readJwtExpiryMs(credential.idToken) ?? this.readJwtExpiryMs(credential.accessToken);
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
    credential: Extract<PreparedAgentApplySelection["credential"], { kind: "openai_session" }>,
  ): string | undefined {
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
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }

    try {
      const encoded = parts[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
      const payload = Buffer.from(encoded, "base64").toString("utf8");
      const parsed = JSON.parse(payload);
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }

  private static createApplySupport(
    endpointRegistry: AgentWorkspaceContext["endpointRegistry"],
    accessRegistry: AgentWorkspaceContext["accessRegistry"],
    agentSelection: AgentWorkspaceContext["agentSelection"],
    agentConnectionSettings: AgentWorkspaceContext["agentConnectionSettings"],
    logger: NileLogger,
    credentialStore: CredentialStore,
  ): AgentApplySupport {
    return new AgentApplySupport(
      OPENCLAW_AGENT_ID,
      endpointRegistry,
      accessRegistry,
      agentSelection,
      agentConnectionSettings,
      credentialStore,
      logger,
      (message) => new ApplySelectionValidationError(message),
    );
  }
}
