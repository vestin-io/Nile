import { GenericPasswordWriter } from "@nile/core/services/credential";
import { GeminiCredentialDocumentCodec } from "./Document";
import {
  GEMINI_KEYCHAIN_ACCOUNT,
  GEMINI_KEYCHAIN_SERVICE,
  type GeminiLocalSessionCredential,
} from "./types";

type GenericPasswordClient = Pick<GenericPasswordWriter, "read" | "write" | "remove">;

export class GeminiKeychainCredentialStore {
  constructor(
    private readonly client: GenericPasswordClient = new GenericPasswordWriter(),
    private readonly codec: GeminiCredentialDocumentCodec = new GeminiCredentialDocumentCodec(),
    private readonly serviceName: string = GEMINI_KEYCHAIN_SERVICE,
    private readonly accountName: string = GEMINI_KEYCHAIN_ACCOUNT,
  ) {}

  snapshot(): string | null {
    let result;
    try {
      result = this.client.read({
        account: this.accountName,
        service: this.serviceName,
        includeSecret: true,
      });
    } catch (error) {
      if (this.isUnavailable(error instanceof Error ? error.message : String(error))) {
        return null;
      }
      throw error;
    }

    if (result.exitCode === 0) {
      return result.stdout;
    }
    if (this.isMissing(result.stderr) || this.isUnavailable(result.stderr, result.errorMessage)) {
      return null;
    }

    throw new Error(this.buildError("read", result.stderr, result.errorMessage));
  }

  hasCredential(): boolean {
    let result;
    try {
      result = this.client.read({
        account: this.accountName,
        service: this.serviceName,
        includeSecret: false,
      });
    } catch (error) {
      if (this.isUnavailable(error instanceof Error ? error.message : String(error))) {
        return false;
      }
      throw error;
    }

    if (result.exitCode === 0) {
      return true;
    }
    if (this.isMissing(result.stderr) || this.isUnavailable(result.stderr, result.errorMessage)) {
      return false;
    }

    throw new Error(this.buildError("probe", result.stderr, result.errorMessage));
  }

  readCredential(): GeminiLocalSessionCredential | null {
    const raw = this.snapshot();
    if (!raw?.trim()) {
      return null;
    }
    return this.codec.readCredential(raw);
  }

  apply(credential: GeminiLocalSessionCredential): void {
    const result = this.client.write({
      account: this.accountName,
      service: this.serviceName,
      secret: this.codec.serialize(credential),
      update: this.hasCredential(),
    });

    if (result.exitCode === 0) {
      return;
    }

    throw new Error(this.buildError("write", result.stderr, result.errorMessage));
  }

  restore(snapshot: string | null): void {
    if (snapshot === null) {
      if (!this.hasCredential()) {
        return;
      }

      const result = this.client.remove({
        account: this.accountName,
        service: this.serviceName,
      });
      if (result.exitCode === 0 || this.isMissing(result.stderr)) {
        return;
      }
      throw new Error(this.buildError("delete", result.stderr, result.errorMessage));
    }

    const result = this.client.write({
      account: this.accountName,
      service: this.serviceName,
      secret: snapshot,
      update: this.hasCredential(),
    });

    if (result.exitCode === 0) {
      return;
    }

    throw new Error(this.buildError("restore", result.stderr, result.errorMessage));
  }

  private isMissing(stderr: string): boolean {
    return /could not be found|item not found|errsecitemnotfound/i.test(stderr);
  }

  private isUnavailable(stderr?: string, errorMessage?: string): boolean {
    const detail = [stderr, errorMessage].filter(Boolean).join("\n");
    return /keychain helper was not found|one or more parameters passed to a function were not valid/i.test(detail);
  }

  private buildError(action: string, stderr: string, errorMessage?: string): string {
    const detail = stderr.trim() || errorMessage?.trim() || "unknown keychain error";
    return `Gemini keychain credential ${action} failed: ${detail}`;
  }
}
