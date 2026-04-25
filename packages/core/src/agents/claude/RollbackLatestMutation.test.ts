import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { AccessRegistry } from "../../models/access";
import { EndpointRegistry } from "../../models/endpoint";
import { AgentSelection } from "../../models/selection/Selection";
import type { StoredCredential } from "../../services/credential/Types";
import { KeychainCredentialStore } from "../../services/credential/KeychainCredentialStore";
import { SecureSnapshotStore } from "../../services/history/SecureSnapshotStore";
import { MutationHistory } from "../../services/history/MutationHistory";
import { NileLogger } from "../../services/NileLogger";
import { AgentApplySupport } from "../../actions/use/ApplySupport";
import { AgentAdapterContextSession } from "../../runtime-local/AgentAdapterContext";
import { ApplySelection } from "./ApplySelection";
import { CLAUDE_AGENT_ID } from "./types";
import { ClaudeCredentialStore } from "./Store";
import { RollbackLatestMutation } from "./RollbackLatestMutation";
import { ClaudeSettingsStore } from "./SettingsStore";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("RollbackLatestMutation", () => {
  it("removes created Claude live files and clears selection on rollback", () => {
    const setup = createSetup();
    seedProvider(setup.dbPath, {
      id: "anthropic-team",
      label: "Anthropic Team",
      endpointFamily: "anthropic",
      supportedAuthModes: ["claude_session"],
      agentCompatibility: ["claude"],
    });
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "claude-team",
        endpointId: "anthropic-team",
        label: "Claude Team",
        authMode: "claude_session",
      },
      {
        kind: "claude_session",
        accessToken: "new-access",
        refreshToken: "new-refresh",
        accountUuid: "acct-1",
        organizationUuid: "org-1",
        email: "team@example.com",
        displayName: "Team",
      },
    );
    seedConnection(setup.dbPath, setup.credentialStore, {
      id: "claude-team-connection",
      endpointId: "anthropic-team",
      accessId: "claude-team",
      label: "Claude Team",
      authMode: "claude_session",
    });

    const context = AgentAdapterContextSession.open(setup.dbPath, setup.credentialStore);
    const mutationHistory = MutationHistory.fromDatabase(setup.dbPath, context.database, {
      secureSnapshotStore: setup.secureSnapshots,
      logger: NileLogger.silent(),
    });
    const applySelection = new ApplySelection(
      mutationHistory,
      new ClaudeSettingsStore(setup.claudeHome),
      new ClaudeCredentialStore(setup.claudeHome),
      new AgentApplySupport(
        CLAUDE_AGENT_ID,
        context.endpointRegistry,
        context.accessRegistry,
        context.agentSelection,
        setup.credentialStore,
        NileLogger.silent(),
        (message: string) => new Error(message),
      ),
    );

    applySelection.apply("claude-team-connection");

    const rollback = new RollbackLatestMutation(
      mutationHistory,
      context.agentSelection,
      { reconcileAgentSelection() { return null; }, close() {} } as any,
      NileLogger.silent(),
    );

    rollback.rollback();

    const agentSelection = AgentSelection.open(setup.dbPath);
    expect(agentSelection.get(CLAUDE_AGENT_ID)).toBeNull();
    agentSelection.close();
    expect(setup.settingsStore.snapshot()).toBeNull();
    expect(setup.credentialFileStore.snapshot()).toBeNull();

    rollback.close();
  });
});

function createSetup() {
  const dir = mkdtempSync(join(tmpdir(), "nile-claude-rollback-"));
  tempDirs.push(dir);
  const claudeHome = join(dir, ".claude");
  return {
    dbPath: join(dir, "switcher.sqlite"),
    claudeHome,
    settingsStore: new ClaudeSettingsStore(claudeHome),
    credentialFileStore: new ClaudeCredentialStore(claudeHome),
    credentialStore: new StubCredentialStore(),
    secureSnapshots: new MemorySecureSnapshotStore(),
  };
}

function seedProvider(
  dbPath: string,
  input: {
    id: string;
    label: string;
    endpointFamily?: "anthropic";
    supportedAuthModes?: Array<"claude_session">;
    agentCompatibility?: Array<"claude" | "codex" | "cursor">;
  },
): void {
  const endpointRegistry = EndpointRegistry.open(dbPath);
  endpointRegistry.add({
    id: input.id,
    label: input.label,
    rootUrl: "https://api.anthropic.com",
    profile: "anthropic-official",
    protocols: {
      anthropic: {
        basePath: "/v1",
        authSchemes: ["x_api_key"],
        envKeyOverride: "ANTHROPIC_API_KEY",
        versionHeader: "2023-06-01",
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
    authMode: "claude_session";
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
    authMode: "claude_session";
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
