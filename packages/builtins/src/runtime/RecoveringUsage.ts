import type { Usage as SharedUsage } from "@nile/core/actions/usage/Usage";
import type { ConnectionUsageResult } from "@nile/core/actions/usage/Result";
import type { AccessRegistry } from "@nile/core/models/access";
import { SessionCredentialRequestBuilder } from "@nile/core/session/RequestBuilder";
import { CURRENT_SESSION_SOURCE_REGISTRY, CurrentSessionResolver } from "@nile/core/session";
import type { CurrentSessionCredentialRequest } from "@nile/core/session/Types";
import type { StoredCredential } from "@nile/core/services/credential/Types";
import type { NileLogger } from "@nile/core/services/NileLogger";
import { ConnectionIdentityKeyResolver } from "@nile/connections/support";

export class RecoveringUsage {
  private readonly requestBuilder = new SessionCredentialRequestBuilder();
  private readonly identityKeyResolver = new ConnectionIdentityKeyResolver();

  constructor(
    private readonly usage: SharedUsage,
    private readonly accessRegistry: AccessRegistry,
    private readonly currentSessionResolver: CurrentSessionResolver,
    private readonly logger: NileLogger,
  ) {}

  async get(connectionId: string): Promise<ConnectionUsageResult> {
    const result = await this.usage.get(connectionId);
    const recovered = await this.retryAfterCurrentSessionSync(connectionId, result);
    return recovered ?? result;
  }

  private async retryAfterCurrentSessionSync(
    connectionId: string,
    result: ConnectionUsageResult,
  ): Promise<ConnectionUsageResult | null> {
    if (result.status !== "error" || result.errorCode !== "credential_unauthorized") {
      return null;
    }

    const access = this.accessRegistry.get(connectionId);
    if (!access) {
      return null;
    }

    const request = this.readRecoveryRequest(access.authMode);
    if (!request) {
      return null;
    }

    await this.recoverUnauthorizedCurrentSession(connectionId, access.authMode, request);

    let credential: StoredCredential;
    try {
      credential = this.currentSessionResolver.resolve(request);
    } catch (error) {
      this.logger.warn("connection-usage.current-session-sync.failed", {
        connectionId,
        authMode: access.authMode,
        source: request.source,
        reason: "resolve_failed",
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }

    const savedIdentityKey = access.identityKey?.trim() || null;
    const currentIdentityKey = this.identityKeyResolver.resolve(access.authMode, credential);
    if (!savedIdentityKey || !currentIdentityKey || currentIdentityKey !== savedIdentityKey) {
      this.logger.warn("connection-usage.current-session-sync.skipped", {
        connectionId,
        authMode: access.authMode,
        source: request.source,
        reason: "identity_mismatch",
        savedIdentityKey,
        currentIdentityKey,
      });
      return null;
    }

    this.accessRegistry.syncCredential(connectionId, credential);
    this.logger.info("connection-usage.current-session-sync.succeeded", {
      connectionId,
      authMode: access.authMode,
      source: request.source,
    });

    const retried = await this.usage.get(connectionId);
    this.logger.info("connection-usage.current-session-sync.retried", {
      connectionId,
      authMode: access.authMode,
      status: retried.status,
      errorCode: retried.errorCode,
    });
    return retried;
  }

  private async recoverUnauthorizedCurrentSession(
    connectionId: string,
    authMode: "api_key" | "claude_session" | "cursor_session" | "gemini_cli_session" | "openai_session" | "openclaw_openai_session",
    request: CurrentSessionCredentialRequest,
  ): Promise<void> {
    try {
      const recovered = await this.currentSessionResolver.recoverUnauthorizedUsage(request);
      if (!recovered) {
        return;
      }
    } catch (error) {
      this.logger.warn("connection-usage.current-session-refresh.failed", {
        connectionId,
        authMode,
        source: request.source,
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    this.logger.info("connection-usage.current-session-refresh.succeeded", {
      connectionId,
      authMode,
      source: request.source,
    });
  }

  private readRecoveryRequest(
    authMode: "api_key" | "claude_session" | "cursor_session" | "gemini_cli_session" | "openai_session" | "openclaw_openai_session",
  ): CurrentSessionCredentialRequest | null {
    if (authMode === "api_key" || authMode === "openclaw_openai_session") {
      return null;
    }

    const request = this.requestBuilder.buildCurrentByAuthMode(authMode);
    const manifest = CURRENT_SESSION_SOURCE_REGISTRY.read(request.source);
    return manifest.usageUnauthorizedRecovery === "sync_current_session_and_retry"
      ? request
      : null;
  }
}
