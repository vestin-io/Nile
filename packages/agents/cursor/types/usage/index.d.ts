export type CursorUsageSessionCandidate = {
  sourceId: string;
  sourceLabel: string;
  locationLabel: string;
  workosUserId: string;
  sessionToken: string;
};

export interface CursorUsageSessionProbe {
  probe(): CursorUsageSessionCandidate[];
}

export declare class EmptyCursorUsageSessionProbe implements CursorUsageSessionProbe {
  probe(): CursorUsageSessionCandidate[];
}

export type BindCursorUsageResult = {
  connectionId: string;
  connectionLabel: string;
  endpointLabel: string;
  endpointFamily: string;
  workosUserId: string;
  boundAt: string;
};

export type CursorUsageAutoBindResult =
  | {
      connectionId: string;
      status: "bound";
      binding: BindCursorUsageResult;
      sourceLabel: string;
      locationLabel: string;
    }
  | {
      connectionId: string;
      status: "already_bound";
    }
  | {
      connectionId: string;
      status: "no_session_found";
    }
  | {
      connectionId: string;
      status: "not_cursor_connection";
    };

export declare class CursorUsageBindingValidationError extends Error {
  constructor(message: string);
}

export declare class CursorUsageIdentityError extends Error {
  constructor(message: string);
}

export declare class CursorUsageIdentity {
  static fromUsageSessionToken(sessionToken: string): {
    authId: string;
    workosUserId: string;
    email?: string;
  };
  static normalizeToken(value: string): string;
}

export declare class CursorUsageBindingRegistry {
  static open(
    databasePath: string,
    credentialStore: import("@nile/core/services/credential/Store").CredentialStore,
  ): CursorUsageBindingRegistry;
  static fromDatabase(
    database: import("@nile/core/services/database/SqliteDatabase").SqliteDatabase,
    credentialStore: import("@nile/core/services/credential/Store").CredentialStore,
  ): CursorUsageBindingRegistry;
  bind(
    input: {
      connectionId: string;
      accountFingerprint: {
        authId: string;
        workosUserId: string;
        email?: string;
      };
    },
    sessionToken: string,
  ): {
    connectionId: string;
    accountFingerprint: {
      authId: string;
      workosUserId: string;
      email?: string;
    };
    lastVerifiedAt: string;
  };
  get(connectionId: string): unknown | null;
  clear(connectionId: string): void;
  readCredential(connectionId: string): { sessionToken: string };
  close(): void;
}

export declare class CursorUsageSnapshotStore {
  static open(databasePath: string): CursorUsageSnapshotStore;
  static fromDatabase(
    database: import("@nile/core/services/database/SqliteDatabase").SqliteDatabase,
  ): CursorUsageSnapshotStore;
  get(connectionId: string): unknown | null;
  save(input: unknown): unknown;
  updateFreshness(connectionId: string, freshness: "live" | "cached" | "stale" | "expired"): unknown | null;
  remove(connectionId: string): void;
  close(): void;
}

export declare class CursorUsageBinder {
  constructor(endpointRegistry: unknown, accessRegistry: unknown, bindingRegistry: CursorUsageBindingRegistry);
  bind(connectionId: string, sessionToken: string): BindCursorUsageResult;
}

export declare class CursorUsageReader {
  constructor(bindingRegistry: CursorUsageBindingRegistry, snapshotStore: CursorUsageSnapshotStore);
  read(input: {
    connectionId: string;
    connectionLabel: string;
    endpointLabel: string;
    access: unknown;
  }): Promise<import("@nile/core/actions/usage").ConnectionUsageResult>;
}

export declare class CursorUsageAutoBinder {
  constructor(
    endpointRegistry: unknown,
    accessRegistry: unknown,
    bindingRegistry: CursorUsageBindingRegistry,
    sessionProbe?: CursorUsageSessionProbe,
  );
  autoBind(connectionId: string): CursorUsageAutoBindResult;
  autoBindAllMissing(): CursorUsageAutoBindResult[];
}

export type ConnectionChangeResult = {
  id: string;
  endpointFamily: string | null;
  authMode: string;
};

export declare class CursorUsageConnectionFollowUp {
  constructor(autoBindCursorUsage: (connectionId: string) => void, logger?: import("@nile/core/services/NileLogger").NileLogger);
  applyAfterConnectionChange<T extends { id: string; endpointFamily: string; authMode: string }>(result: Promise<T>): Promise<T>;
  applyAfterResolvedConnectionChange<T extends { id: string; endpointFamily: string; authMode: string }>(result: T): T;
}

export declare class CursorUsageWorkspace {
  static open(options: {
    databasePath: string;
    credentialStore: import("@nile/core/services/credential/Store").CredentialStore;
    sessionProbe?: CursorUsageSessionProbe;
    logger?: import("@nile/core/services/NileLogger").NileLogger;
  }): CursorUsageWorkspace;
  bind(connectionId: string, sessionToken: string): BindCursorUsageResult;
  autoBind(connectionId: string): CursorUsageAutoBindResult;
  autoBindAllMissing(): CursorUsageAutoBindResult[];
  clearArtifacts(connectionId: string): void;
  applyFollowUp<T extends ConnectionChangeResult>(result: T): T;
  close(): void;
}

export declare function runWithCursorUsageWorkspace<TResult>(
  options: {
    databasePath: string;
    credentialStore: import("@nile/core/services/credential/Store").CredentialStore;
    sessionProbe?: CursorUsageSessionProbe;
    logger?: import("@nile/core/services/NileLogger").NileLogger;
  },
  work: (workspace: CursorUsageWorkspace) => TResult,
): TResult;

export declare class CursorLocalConnectionSupportFactory {
  readonly credentialRefQuery: string;
  create(
    database: import("@nile/core/services/database/SqliteDatabase").SqliteDatabase,
    credentialStore: import("@nile/core/services/credential/Store").CredentialStore,
    endpointRegistry: import("@nile/core/models/endpoint").EndpointRegistry,
    accessRegistry: import("@nile/core/models/access").AccessRegistry,
  ): import("@nile/core/runtime-local/LocalConnectionSupport").LocalConnectionSupport;
}

export declare const CURSOR_LOCAL_CONNECTION_SUPPORT_FACTORY: CursorLocalConnectionSupportFactory;
