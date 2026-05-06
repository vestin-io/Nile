import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "../../models/access";
import { EndpointRegistry } from "../../models/endpoint";
import { AgentSelection } from "../../models/selection/Selection";
import type { StoredCredential } from "../../services/credential/Types";
import { KeychainCredentialStore } from "../../services/credential/KeychainCredentialStore";
import { SecureSnapshotStore } from "../../services/history/SecureSnapshotStore";
import { MutationHistory } from "../../services/history/MutationHistory";
import { FileSnapshotStore } from "../../services/history/FileSnapshotStore";
import { NileLogger } from "../../services/NileLogger";
import { AgentApplySupport } from "../../actions/apply/Support";
import { AgentWorkspaceSession } from "../../runtime-local/AgentWorkspaceSession";
import { ApplyMutation } from "../ApplyMutation";
import { ApplySelection } from "./ApplySelection";
import { CURSOR_AGENT_ID, type CursorLiveCredentialSnapshot } from "./types";
import { RollbackLatestMutation } from "./RollbackLatestMutation";
import { CursorConfigStore } from "./stores/CursorConfigStore";
import { CursorHistoryTargets } from "./HistoryTargets";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("RollbackLatestMutation", () => {
  it("restores the previous Cursor config and keychain snapshot", () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "cursor",
      label: "Cursor",
      endpointFamily: "cursor",
      supportedAuthModes: ["cursor_session"],
      agentCompatibility: ["cursor"],
    });
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "cursor-team",
        endpointId: "cursor",
        label: "Cursor Team",
        authMode: "cursor_session",
      },
      {
        kind: "cursor_session",
        accessToken: "new-access",
        refreshToken: "new-refresh",
        authId: "new-auth",
        authCacheKey: "auth:new-auth",
        email: "new@example.com",
        displayName: "New",
        userId: 99,
      },
    );
    seedConnection(setup.dbPath, setup.credentialStore, {
      id: "cursor-team-connection",
      endpointId: "cursor",
      accessId: "cursor-team",
      label: "Cursor Team",
      authMode: "cursor_session",
    });

    const context = AgentWorkspaceSession.open(setup.dbPath, setup.credentialStore);
    const mutationHistory = MutationHistory.fromDatabase(setup.dbPath, context.workspaceState.database, {
      secureSnapshotStore: setup.secureSnapshots,
      logger: NileLogger.silent(),
    });
    const applySupport = new AgentApplySupport(
      CURSOR_AGENT_ID,
      context.sharedContext.endpointRegistry,
      context.sharedContext.accessRegistry,
      context.agentSelection,
      setup.credentialStore,
      NileLogger.silent(),
      (message: string) => new Error(message),
    );
    const applySelection = new ApplySelection(
      new ApplyMutation(
        mutationHistory,
        applySupport,
        NileLogger.silent(),
      ),
      new CursorConfigStore(setup.cursorHome),
      setup.cursorCredentialStore as any,
    );

    applySelection.apply("cursor-team-connection");

    const rollback = new RollbackLatestMutation(
      mutationHistory,
      new FileSnapshotStore(join(dirname(setup.dbPath), "history")),
      setup.secureSnapshots,
      context.agentSelection,
      { reconcileAgentSelection() { return null; }, close() {} } as any,
      new CursorConfigStore(setup.cursorHome),
      setup.cursorCredentialStore as any,
      NileLogger.silent(),
    );

    rollback.rollback();

    const agentSelection = AgentSelection.open(setup.dbPath);
    expect(agentSelection.get(CURSOR_AGENT_ID)).toBeNull();
    agentSelection.close();
    expect(readFileSync(join(setup.cursorHome, "cli-config.json"), "utf8")).toContain('"backendUrl": "https://legacy.cursor.sh"');
    expect(setup.cursorCredentialStore.snapshot()).toEqual({
      accessToken: "legacy-access",
      refreshToken: "legacy-refresh",
      apiKey: null,
    });

    rollback.close();
  });
});

function createSetup() {
  const dir = mkdtempSync(join(tmpdir(), "nile-cursor-rollback-"));
  tempDirs.push(dir);
  const cursorHome = join(dir, ".cursor");
  mkdirSync(cursorHome, { recursive: true });
  writeFileSync(
    join(cursorHome, "cli-config.json"),
    `${JSON.stringify({
      serverConfigCache: { backendUrl: "https://legacy.cursor.sh", authCacheKey: "auth:legacy" },
      authInfo: { email: "legacy@example.com", authId: "legacy-auth", userId: 1 },
    }, null, 2)}\n`,
    "utf8",
  );

  return {
    dbPath: join(dir, "switcher.sqlite"),
    cursorHome,
    credentialStore: new StubCredentialStore(),
    cursorCredentialStore: new MemoryCursorCredentialStore({
      accessToken: "legacy-access",
      refreshToken: "legacy-refresh",
      apiKey: null,
    }),
    secureSnapshots: new MemorySecureSnapshotStore(),
  };
}

function seedProvider(
  dbPath: string,
  input: {
    id: string;
    label: string;
    endpointFamily?: "cursor";
    supportedAuthModes?: Array<"cursor_session">;
    agentCompatibility?: Array<"claude" | "codex" | "cursor">;
  },
): void {
  const endpointRegistry = EndpointRegistry.open(dbPath);
  endpointRegistry.add({
    id: input.id,
    label: input.label,
    rootUrl: "https://api2.cursor.sh",
    profile: "cursor-backend",
    protocols: {
      cursor: {
        backendPath: "",
      },
    },
  });
  endpointRegistry.close();
}

function seedAccess(
  _dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    id: string;
    endpointId: string;
    label: string;
    authMode: "cursor_session";
  },
  credential: StoredCredential,
): void {
  credentialStore.create(`access:${input.id}`, credential);
}

function seedConnection(
  dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    id: string;
    endpointId: string;
    accessId: string;
    label: string;
    authMode: "cursor_session";
  },
): void {
  const accessRegistry = AccessRegistry.open(dbPath, credentialStore);
  accessRegistry.add(
    {
      id: input.id,
      endpointId: input.endpointId,
      label: input.label,
      authMode: input.authMode,
    },
    credentialStore.get(`access:${input.accessId}`),
  );
  accessRegistry.close();
}

class StubCredentialStore extends KeychainCredentialStore {
  private readonly records = new Map<string, StoredCredential>();

  override create(reference: string, credential: StoredCredential): void {
    this.records.set(reference, credential);
  }

  override update(reference: string, credential: StoredCredential): void {
    this.records.set(reference, credential);
  }

  override get(reference: string): StoredCredential {
    const credential = this.records.get(reference);
    if (!credential) {
      throw new Error(`Credential not found: ${reference}`);
    }
    return credential;
  }

  override has(reference: string): boolean {
    return this.records.has(reference);
  }

  override remove(reference: string): void {
    this.records.delete(reference);
  }
}

class MemoryCursorCredentialStore {
  constructor(private current: CursorLiveCredentialSnapshot) {}

  snapshot(): CursorLiveCredentialSnapshot {
    return { ...this.current };
  }

  applySession(accessToken: string, refreshToken: string): void {
    this.current = {
      accessToken,
      refreshToken,
      apiKey: null,
    };
  }

  applyApiKey(apiKey: string): void {
    this.current = {
      accessToken: null,
      refreshToken: null,
      apiKey,
    };
  }

  restore(snapshot: CursorLiveCredentialSnapshot): void {
    this.current = { ...snapshot };
  }
}

class MemorySecureSnapshotStore extends SecureSnapshotStore {
  private readonly snapshots = new Map<string, string>();

  override writeBeforeSnapshot(snapshotRef: string, content: string | null) {
    this.snapshots.set(snapshotRef, content ?? "");
    return {
      snapshotRef,
      checksum: this.checksum(content),
    };
  }

  override readSnapshot(snapshotRef: string): string {
    return this.snapshots.get(snapshotRef) ?? "";
  }

  override restoreSnapshot(snapshotRef: string, targetPath: string, existedBefore: boolean): void {
    if (!existedBefore) {
      rmSync(targetPath, { force: true });
      return;
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, this.snapshots.get(snapshotRef) ?? "", "utf8");
  }
}
