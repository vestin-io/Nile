import { GeminiCredentialStore } from "./CredentialStore";
import { GeminiKeychainCredentialStore } from "./KeychainStore";
import {
  PreferredSessionCredentialBackend,
  type PreferredSessionBackendReadResult,
} from "@nile/core/session/backend";
import type {
  GeminiCredentialBackendKind,
  GeminiCredentialBackendSnapshot,
  GeminiLocalSessionCredential,
} from "./types";
import type {
  GeminiCliSessionCredential,
} from "@nile/core/services/credential";
type WritableStore = Pick<GeminiCredentialStore, "snapshot" | "readCredential" | "apply" | "restore">;

export type GeminiCredentialWriteTarget = GeminiCredentialBackendKind | "file-default";

type WriteTargetStore = {
  target: GeminiCredentialWriteTarget;
  store: WritableStore;
};

type StoredSessionCredential = GeminiLocalSessionCredential | GeminiCliSessionCredential;

export function toGeminiLocalSessionCredential(
  credential: StoredSessionCredential,
): GeminiLocalSessionCredential {
  return {
    accessToken: credential.accessToken,
    refreshToken: credential.refreshToken,
    idToken: credential.idToken,
    ...(credential.expiryDate !== undefined ? { expiryDate: credential.expiryDate } : {}),
    ...(credential.tokenType ? { tokenType: credential.tokenType } : {}),
    ...(credential.scope ? { scope: credential.scope } : {}),
  };
}

export class GeminiCredentialBackend {
  private readonly backend: PreferredSessionCredentialBackend<GeminiCredentialBackendKind, GeminiLocalSessionCredential>;

  constructor(
    private readonly fileStore: GeminiCredentialStore,
    private readonly keychainStore: GeminiKeychainCredentialStore,
  ) {
    this.backend = new PreferredSessionCredentialBackend(
      {
        kind: "keychain",
        store: keychainStore,
        incompleteMessage: "Gemini keychain OAuth credential is incomplete",
      },
      {
        kind: "file",
        store: fileStore,
        incompleteMessage: "Gemini file OAuth credential is incomplete",
      },
      () => this.resolveBackendWriteStore(),
    );
  }

  snapshot(): GeminiCredentialBackendSnapshot {
    const snapshot = this.backend.snapshot();
    return {
      keychain: snapshot.preferred,
      file: snapshot.fallback,
    };
  }

  readCurrent(): ReadBackendCredentialResult {
    return this.backend.readCurrent();
  }

  apply(credential: StoredSessionCredential): GeminiCredentialWriteTarget {
    const target = this.resolveWriteTarget();
    target.store.apply(toGeminiLocalSessionCredential(credential));
    return target.target;
  }

  restoreSnapshot(snapshot: GeminiCredentialBackendSnapshot): void {
    this.backend.restoreSnapshot({
      preferred: snapshot.keychain,
      fallback: snapshot.file,
    });
  }

  private resolveWriteTarget(): WriteTargetStore {
    if (this.keychainStore.hasCredential()) {
      return {
        target: "keychain",
        store: this.keychainStore,
      };
    }

    if (this.fileStore.snapshot()?.trim()) {
      return {
        target: "file",
        store: this.fileStore,
      };
    }

    return {
      target: "file-default",
      store: this.fileStore,
    };
  }

  private resolveBackendWriteStore(): {
    kind: GeminiCredentialBackendKind;
    store: WritableStore;
    incompleteMessage: string;
  } {
    if (this.keychainStore.hasCredential()) {
      return {
        kind: "keychain",
        store: this.keychainStore,
        incompleteMessage: "Gemini keychain OAuth credential is incomplete",
      };
    }

    return {
      kind: "file",
      store: this.fileStore,
      incompleteMessage: "Gemini file OAuth credential is incomplete",
    };
  }
}

export type ReadBackendCredentialResult = PreferredSessionBackendReadResult<
  GeminiCredentialBackendKind,
  GeminiLocalSessionCredential
>;
