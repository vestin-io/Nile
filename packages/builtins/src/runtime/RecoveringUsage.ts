import type { Usage as SharedUsage } from "@nile/core/actions/usage/Usage";
import type { ConnectionUsageResult } from "@nile/core/actions/usage/Result";
import type { AccessRegistry } from "@nile/core/models/access";
import { SessionCredentialRequestBuilder } from "@nile/core/session/RequestBuilder";
import { CURRENT_SESSION_SOURCE_REGISTRY, CurrentSessionResolver } from "@nile/core/session";
import type { CurrentSessionCredentialRequest } from "@nile/core/session/Types";
import type { StoredCredential } from "@nile/core/services/credential/Types";
import type { NileLogger } from "@nile/core/services/NileLogger";
import { ConnectionIdentityKeyResolver } from "@nile/connections/support";

type RecoverableSessionAuthMode =
  | "claude_session"
  | "cursor_session"
  | "gemini_cli_session"
  | "openai_session";

export class RecoveringUsage {
  private readonly requestBuilder = new SessionCredentialRequestBuilder();
  private readonly identityKeyResolver = new ConnectionIdentityKeyResolver();

  constructor(
    private readonly usage: SharedUsage,
    private readonly accessRegistry: AccessRegistry,
    private readonly currentSessionResolver: CurrentSessionResolver,
    private readonly logger: NileLogger,
  ) {}

  async get(
    connectionId: string,
    options?: { recoverUnauthorizedCurrentSession?: boolean },
  ): Promise<ConnectionUsageResult> {
    const result = await this.usage.get(connectionId);
    const recovered = await this.retryAfterCurrentSessionSync(connectionId, result, options);
    return recovered ?? result;
  }

  private async retryAfterCurrentSessionSync(
    connectionId: string,
    result: ConnectionUsageResult,
    options?: { recoverUnauthorizedCurrentSession?: boolean },
  ): Promise<ConnectionUsageResult | null> {
    if (result.status !== "error" || result.errorCode !== "credential_unauthorized") {
      return null;
    }
    if (options?.recoverUnauthorizedCurrentSession === false) {
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
    const recoverableAuthMode = this.toRecoverableSessionAuthMode(access.authMode);
    if (!recoverableAuthMode) {
      return null;
    }

    if (recoverableAuthMode === "openai_session") {
      const synced = await this.retryWithResolvedCurrentSession(connectionId, recoverableAuthMode, request);
      if (synced?.skipRecovery) {
        return synced.result;
      }
      if (synced?.result && !this.isCredentialUnauthorized(synced.result)) {
        return synced.result;
      }
    }

    await this.recoverUnauthorizedCurrentSession(connectionId, recoverableAuthMode, request);

    const credential = this.resolveCurrentSessionCredential(connectionId, recoverableAuthMode, request);
    if (!credential) {
      return null;
    }

    if (this.syncCurrentSessionCredential(
      connectionId,
      recoverableAuthMode,
      request,
      access.identityKey?.trim() || null,
      credential,
    ) !== "synced") {
      return null;
    }
    return await this.retryUsageAfterCurrentSessionSync(connectionId, recoverableAuthMode, request);
  }

  private async recoverUnauthorizedCurrentSession(
    connectionId: string,
    authMode: RecoverableSessionAuthMode,
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
    authMode: "api_key" | RecoverableSessionAuthMode | "openclaw_openai_session",
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

  private async retryWithResolvedCurrentSession(
    connectionId: string,
    authMode: RecoverableSessionAuthMode,
    request: CurrentSessionCredentialRequest,
  ): Promise<{ result: ConnectionUsageResult; skipRecovery: boolean } | null> {
    const access = this.accessRegistry.get(connectionId);
    if (!access) {
      return null;
    }

    const credential = this.resolveCurrentSessionCredential(connectionId, authMode, request);
    if (!credential) {
      return null;
    }
    const syncOutcome = this.syncCurrentSessionCredential(
      connectionId,
      authMode,
      request,
      access.identityKey?.trim() || null,
      credential,
    );
    if (syncOutcome === "identity_mismatch") {
      return { result: await this.usage.get(connectionId), skipRecovery: true };
    }
    if (syncOutcome !== "synced") {
      return null;
    }

    return {
      result: await this.retryUsageAfterCurrentSessionSync(connectionId, authMode, request),
      skipRecovery: false,
    };
  }

  private resolveCurrentSessionCredential(
    connectionId: string,
    authMode: RecoverableSessionAuthMode,
    request: CurrentSessionCredentialRequest,
  ): StoredCredential | null {
    try {
      return this.currentSessionResolver.resolve(request);
    } catch (error) {
      this.logger.warn("connection-usage.current-session-sync.failed", {
        connectionId,
        authMode,
        source: request.source,
        reason: "resolve_failed",
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private syncCurrentSessionCredential(
    connectionId: string,
    authMode: RecoverableSessionAuthMode,
    request: CurrentSessionCredentialRequest,
    savedIdentityKey: string | null,
    credential: StoredCredential,
  ): "synced" | "identity_mismatch" | "identity_unresolved" {
    const currentIdentityKey = this.identityKeyResolver.resolve(authMode, credential);
    if (!savedIdentityKey || !currentIdentityKey) {
      this.logger.warn("connection-usage.current-session-sync.skipped", {
        connectionId,
        authMode,
        source: request.source,
        reason: "identity_unresolved",
        savedIdentityKey,
        currentIdentityKey,
      });
      return "identity_unresolved";
    }
    if (currentIdentityKey !== savedIdentityKey) {
      this.logger.warn("connection-usage.current-session-sync.skipped", {
        connectionId,
        authMode,
        source: request.source,
        reason: "identity_mismatch",
        savedIdentityKey,
        currentIdentityKey,
      });
      return "identity_mismatch";
    }

    this.accessRegistry.syncCredential(connectionId, credential);
    this.logger.info("connection-usage.current-session-sync.succeeded", {
      connectionId,
      authMode,
      source: request.source,
    });
    return "synced";
  }

  private async retryUsageAfterCurrentSessionSync(
    connectionId: string,
    authMode: RecoverableSessionAuthMode,
    request: CurrentSessionCredentialRequest,
  ): Promise<ConnectionUsageResult> {
    const retried = await this.usage.get(connectionId);
    this.logger.info("connection-usage.current-session-sync.retried", {
      connectionId,
      authMode,
      source: request.source,
      status: retried.status,
      errorCode: retried.errorCode,
    });
    return retried;
  }

  private isCredentialUnauthorized(result: ConnectionUsageResult): boolean {
    return result.status === "error" && result.errorCode === "credential_unauthorized";
  }

  private toRecoverableSessionAuthMode(
    authMode: "api_key" | RecoverableSessionAuthMode | "openclaw_openai_session",
  ): RecoverableSessionAuthMode | null {
    if (authMode === "api_key" || authMode === "openclaw_openai_session") {
      return null;
    }
    return authMode;
  }
}
