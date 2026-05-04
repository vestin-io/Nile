import { NileLogger } from "../../../services/NileLogger";
import { SecuritySecretCodec } from "../../../services/credential/SecretCodec";
import { SecurityCli, type SecurityCliResult } from "../../../services/credential/SecurityCli";
import type { CursorLiveCredentialSnapshot } from "../types";

const CURSOR_KEYCHAIN_ACCOUNT = "cursor-user";
const CURSOR_ACCESS_TOKEN_SERVICE = "cursor-access-token";
const CURSOR_REFRESH_TOKEN_SERVICE = "cursor-refresh-token";
const CURSOR_API_KEY_SERVICE = "cursor-api-key";

export class CursorCredentialStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CursorCredentialStoreError";
  }
}

export class CursorCredentialStore {
  constructor(
    private readonly securityCli: SecurityCli = new SecurityCli(),
    private readonly logger: NileLogger = NileLogger.silent().child({ module: "cursor-credential-store" }),
    private readonly secretCodec: SecuritySecretCodec = new SecuritySecretCodec(),
  ) {}

  snapshot(): CursorLiveCredentialSnapshot {
    return {
      accessToken: this.readValue(CURSOR_ACCESS_TOKEN_SERVICE),
      refreshToken: this.readValue(CURSOR_REFRESH_TOKEN_SERVICE),
      apiKey: this.readValue(CURSOR_API_KEY_SERVICE),
    };
  }

  applySession(accessToken: string, refreshToken: string): void {
    this.upsertValue(CURSOR_ACCESS_TOKEN_SERVICE, accessToken);
    this.upsertValue(CURSOR_REFRESH_TOKEN_SERVICE, refreshToken);
    this.deleteValue(CURSOR_API_KEY_SERVICE);
  }

  applyApiKey(apiKey: string): void {
    this.upsertValue(CURSOR_API_KEY_SERVICE, apiKey);
    this.deleteValue(CURSOR_ACCESS_TOKEN_SERVICE);
    this.deleteValue(CURSOR_REFRESH_TOKEN_SERVICE);
  }

  restore(snapshot: CursorLiveCredentialSnapshot): void {
    this.restoreValue(CURSOR_ACCESS_TOKEN_SERVICE, snapshot.accessToken);
    this.restoreValue(CURSOR_REFRESH_TOKEN_SERVICE, snapshot.refreshToken);
    this.restoreValue(CURSOR_API_KEY_SERVICE, snapshot.apiKey);
  }

  private restoreValue(service: string, value: string | null): void {
    if (value) {
      this.upsertValue(service, value);
      return;
    }

    this.deleteValue(service);
  }

  private readValue(service: string): string | null {
    const result = this.securityCli.run([
      "find-generic-password",
      "-a",
      CURSOR_KEYCHAIN_ACCOUNT,
      "-s",
      service,
      "-w",
    ]);

    if (result.exitCode === 0) {
      return this.secretCodec.decode(result.stdout).trim() || null;
    }
    if (this.isMissing(result)) {
      return null;
    }

    this.logger.error("cursor.credential.read.failed", result.stderr, { service });
    throw new CursorCredentialStoreError(
      `Failed to read Cursor keychain entry for ${service}: ${result.stderr.trim() || "unknown error"}`,
    );
  }

  private upsertValue(service: string, value: string): void {
    const result = this.securityCli.runWithSecretData([
      "add-generic-password",
      "-a",
      CURSOR_KEYCHAIN_ACCOUNT,
      "-s",
      service,
      "-U",
      "-w",
    ], this.secretCodec.encode(value));

    if (result.exitCode === 0) {
      return;
    }

    this.logger.error("cursor.credential.write.failed", result.stderr, { service });
    throw new CursorCredentialStoreError(
      `Failed to write Cursor keychain entry for ${service}: ${result.stderr.trim() || "unknown error"}`,
    );
  }

  private deleteValue(service: string): void {
    const result = this.securityCli.run([
      "delete-generic-password",
      "-a",
      CURSOR_KEYCHAIN_ACCOUNT,
      "-s",
      service,
    ]);

    if (result.exitCode === 0 || this.isMissing(result)) {
      return;
    }

    this.logger.error("cursor.credential.delete.failed", result.stderr, { service });
    throw new CursorCredentialStoreError(
      `Failed to delete Cursor keychain entry for ${service}: ${result.stderr.trim() || "unknown error"}`,
    );
  }

  private isMissing(result: SecurityCliResult): boolean {
    return /could not be found|item not found|errsecitemnotfound/i.test(result.stderr);
  }
}
