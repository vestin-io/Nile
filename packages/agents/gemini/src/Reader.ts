import { GeminiCredentialBackend } from "./Backend";
import { GeminiAccountsStore } from "./AccountsStore";
import { GeminiSessionIdentityReader } from "./Identity";
import { GeminiSettingsStore } from "./SettingsStore";
import {
  GEMINI_AUTH_TYPE_OAUTH_PERSONAL,
  type GeminiReadSessionResult,
} from "./types";

export class GeminiSessionReader {
  constructor(
    private readonly credentialBackend: GeminiCredentialBackend,
    private readonly accountsStore: GeminiAccountsStore,
    private readonly settingsStore: GeminiSettingsStore,
    private readonly identityReader: GeminiSessionIdentityReader = new GeminiSessionIdentityReader(),
  ) {}

  read(): GeminiReadSessionResult {
    const selectedAuthType = this.settingsStore.readSelectedAuthType();
    if (selectedAuthType !== GEMINI_AUTH_TYPE_OAUTH_PERSONAL) {
      return {
        kind: "invalid_semantics",
        issues: [
          selectedAuthType
            ? `Gemini settings.json selectedType must be ${GEMINI_AUTH_TYPE_OAUTH_PERSONAL}, received ${selectedAuthType}`
            : `Gemini settings.json does not define security.auth.selectedType`,
        ],
      };
    }

    const backend = this.credentialBackend.readCurrent();
    if (backend.kind === "missing") {
      return {
        kind: "invalid_semantics",
        issues: [
          "Gemini OAuth credential was not found in keychain or oauth_creds.json",
        ],
      };
    }
    if (backend.kind === "invalid_structure") {
      return {
        kind: "invalid_structure",
        issues: [backend.issue],
      };
    }
    if (backend.kind === "invalid_semantics") {
      return {
        kind: "invalid_semantics",
        issues: [backend.issue],
      };
    }

    const accountState = this.accountsStore.readState();
    if (!accountState.active) {
      return {
        kind: "invalid_semantics",
        issues: [
          "Gemini google_accounts.json does not define an active account",
        ],
      };
    }

    const identityKey = this.identityReader.readIdentityKey(backend.credential);
    if (!identityKey) {
      return {
        kind: "invalid_semantics",
        issues: [
          "Gemini OAuth credential id_token is missing identity claims",
        ],
      };
    }

    const credentialEmail = this.identityReader.readEmail(backend.credential);
    const credentialSubject = this.identityReader.readSubject(backend.credential);
    const issues: string[] = [];
    if (credentialEmail && credentialEmail !== accountState.active) {
      issues.push(
        `Gemini active account ${accountState.active} does not match id_token email ${credentialEmail}`,
      );
    }

    return {
      kind: "resolved",
      value: {
        selectedAuthType: GEMINI_AUTH_TYPE_OAUTH_PERSONAL,
        backendKind: backend.backendKind,
        credential: backend.credential,
        activeEmail: accountState.active,
        credentialEmail,
        credentialSubject,
        identityKey,
        labelHint:
          this.identityReader.readDisplayName(backend.credential)
          ?? accountState.active,
        issues,
      },
    };
  }
}
