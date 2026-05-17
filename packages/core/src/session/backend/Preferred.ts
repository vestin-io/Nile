export type ReadableSessionCredentialStore<Credential> = {
  snapshot(): string | null;
  readCredential(): Credential | null;
};

export type WritableSessionCredentialStore<Credential> = ReadableSessionCredentialStore<Credential> & {
  apply(credential: Credential): void;
  restore(snapshot: string | null): void;
};

export type PreferredSessionBackendSnapshot = {
  preferred: string | null;
  fallback: string | null;
};

export type PreferredSessionBackendReadResult<Kind extends string, Credential> =
  | { kind: "resolved"; backendKind: Kind; credential: Credential }
  | { kind: "missing" }
  | { kind: "invalid_structure"; issue: string }
  | { kind: "invalid_semantics"; issue: string };

type SessionBackendStore<Kind extends string, Credential> = {
  kind: Kind;
  store: WritableSessionCredentialStore<Credential>;
  incompleteMessage: string;
};

export class PreferredSessionCredentialBackend<Kind extends string, Credential> {
  constructor(
    private readonly preferred: SessionBackendStore<Kind, Credential>,
    private readonly fallback: SessionBackendStore<Kind, Credential>,
    private readonly selectWriteStore: () => SessionBackendStore<Kind, Credential>,
  ) {}

  snapshot(): PreferredSessionBackendSnapshot {
    return {
      preferred: this.preferred.store.snapshot(),
      fallback: this.fallback.store.snapshot(),
    };
  }

  readCurrent(): PreferredSessionBackendReadResult<Kind, Credential> {
    const preferred = this.readStore(this.preferred);
    if (preferred.kind !== "missing") {
      return preferred;
    }

    return this.readStore(this.fallback);
  }

  apply(credential: Credential): Kind {
    const target = this.selectWriteStore();
    target.store.apply(credential);
    return target.kind;
  }

  restoreSnapshot(snapshot: PreferredSessionBackendSnapshot): void {
    this.preferred.store.restore(snapshot.preferred);
    this.fallback.store.restore(snapshot.fallback);
  }

  private readStore(
    store: SessionBackendStore<Kind, Credential>,
  ): PreferredSessionBackendReadResult<Kind, Credential> {
    let snapshot: string | null;
    try {
      snapshot = store.store.snapshot();
    } catch (error) {
      return {
        kind: "invalid_structure",
        issue: error instanceof Error ? error.message : String(error),
      };
    }

    if (!snapshot?.trim()) {
      return { kind: "missing" };
    }

    try {
      const credential = store.store.readCredential();
      if (!credential) {
        return {
          kind: "invalid_semantics",
          issue: store.incompleteMessage,
        };
      }

      return {
        kind: "resolved",
        backendKind: store.kind,
        credential,
      };
    } catch (error) {
      return {
        kind: "invalid_structure",
        issue: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
