import { isDirectApiKeyCredential, type StoredCredential } from "@nile/core/services/credential";
import type { NileSession } from "@nile/core/runtime-local";
import type { SavedConnectionSummary } from "@nile/core/models/connection";

import { DesktopEnvironmentStore } from "../environment/Store";
import { DesktopShellEnvironment } from "../environment/Shell";

export class ManagedApiKeyEnvironment {
  constructor(
    private readonly store: DesktopEnvironmentStore,
    private readonly shellEnvironment: DesktopShellEnvironment = new DesktopShellEnvironment(),
  ) {}

  async ensureForConnection(session: NileSession, connectionId: string): Promise<SavedConnectionSummary | null> {
    const connection = this.readConnection(session, connectionId);
    if (!connection || connection.authMode !== "api_key") {
      return connection;
    }

    const credential = session.readConnectionCredential(connectionId);
    if (!isDirectApiKeyCredential(credential)) {
      return connection;
    }

    const apiKey = credential.apiKey.trim();
    if (!apiKey) {
      return connection;
    }

    const previousEnvKey = connection.envKey?.trim() || credential.envKey?.trim() || null;
    const envKey = this.readEnvKey(connection, credential);
    if (previousEnvKey === envKey) {
      this.writeManagedEnvironment(envKey, apiKey);
      return connection;
    }

    const updated = session.setConnectionDirectApiKeyEnvKey(connectionId, envKey);
    try {
      this.writeManagedEnvironment(envKey, apiKey);
    } catch (error) {
      this.cleanupManagedEnvironment(envKey);
      session.setConnectionDirectApiKeyEnvKey(connectionId, previousEnvKey);
      throw error;
    }
    return updated;
  }

  syncForSession(session: NileSession, preservedEnvKeys: string[] = []): Array<{ connectionId: string; error: Error }> {
    const shellKeys = [...preservedEnvKeys];
    const failures: Array<{ connectionId: string; error: Error }> = [];
    for (const connection of session.listSavedConnections()) {
      if (connection.authMode !== "api_key") {
        continue;
      }
      try {
        const envKey = this.syncConnectionWithoutShell(session, connection.id);
        if (envKey) {
          shellKeys.push(envKey);
        }
      } catch (error) {
        failures.push({
          connectionId: connection.id,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
    try {
      this.shellEnvironment.sync(shellKeys);
    } catch (error) {
      failures.push({
        connectionId: "managed-shell-environment",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
    return failures;
  }

  removeForConnection(session: NileSession, connectionId: string): void {
    const connection = this.readConnection(session, connectionId);
    const envKey = connection?.envKey?.trim();
    if (!envKey || !envKey.startsWith("NILE_")) {
      return;
    }
    this.removeManagedEnvironment(envKey);
  }

  private readConnection(session: NileSession, connectionId: string): SavedConnectionSummary | null {
    return session.listSavedConnections().find((connection) => connection.id === connectionId) ?? null;
  }

  private readEnvKey(
    connection: SavedConnectionSummary,
    credential: Extract<StoredCredential, { kind: "api_key"; source?: "direct" }>,
  ): string {
    const existingEnvKey = connection.envKey?.trim() || credential.envKey?.trim();
    if (existingEnvKey) {
      return existingEnvKey;
    }
    return this.buildManagedEnvKey(connection.id);
  }

  private buildManagedEnvKey(connectionId: string): string {
    const normalizedConnectionId = connectionId
      .trim()
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();
    return `NILE_${normalizedConnectionId}_API_KEY`;
  }

  private writeManagedEnvironment(envKey: string, apiKey: string): void {
    this.store.write(envKey, apiKey);
    this.shellEnvironment.ensure(envKey);
  }

  private syncConnectionWithoutShell(session: NileSession, connectionId: string): string | null {
    const connection = this.readConnection(session, connectionId);
    if (!connection || connection.authMode !== "api_key") {
      return null;
    }

    const credential = session.readConnectionCredential(connectionId);
    if (!isDirectApiKeyCredential(credential)) {
      return null;
    }

    const apiKey = credential.apiKey.trim();
    if (!apiKey) {
      return null;
    }

    const previousEnvKey = connection.envKey?.trim() || credential.envKey?.trim() || null;
    const envKey = this.readEnvKey(connection, credential);
    if (previousEnvKey === envKey) {
      this.store.write(envKey, apiKey);
      return envKey;
    }

    session.setConnectionDirectApiKeyEnvKey(connectionId, envKey);
    try {
      this.store.write(envKey, apiKey);
    } catch (error) {
      session.setConnectionDirectApiKeyEnvKey(connectionId, previousEnvKey);
      throw error;
    }
    return envKey;
  }

  private removeManagedEnvironment(envKey: string): void {
    this.store.remove(envKey);
    this.shellEnvironment.remove(envKey);
  }

  private cleanupManagedEnvironment(envKey: string): void {
    try {
      this.removeManagedEnvironment(envKey);
    } catch {
      // Ignore cleanup errors while restoring the original connection metadata.
    }
  }
}

export class NoopManagedApiKeyEnvironment {
  async ensureForConnection(_session: NileSession, _connectionId: string): Promise<SavedConnectionSummary | null> {
    return null;
  }

  syncForSession(_session: NileSession): Array<{ connectionId: string; error: Error }> {
    return [];
  }

  removeForConnection(_session: NileSession, _connectionId: string): void {}
}
