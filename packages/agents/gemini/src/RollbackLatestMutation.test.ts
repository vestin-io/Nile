import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { AccessRegistry } from "@nile/core/models/access";
import { EndpointRegistry } from "@nile/core/models/endpoint";
import { AgentSelection } from "@nile/core/models/selection";
import { KeychainCredentialStore } from "@nile/core/services/credential";
import type { StoredCredential } from "@nile/core/services/credential";
import { SecureSnapshotStore } from "@nile/core/services/history";
import { NileLogger } from "@nile/core/services/NileLogger";
import { AgentApplySupport } from "@nile/core/actions/apply";
import { AgentWorkspaceSession } from "@nile/core/runtime-local/AgentWorkspaceSession";
import { ApplyMutation } from "@nile/core/agents/ApplyMutation";
import { ApplySelection } from "./ApplySelection";
import { GeminiAccountsStore } from "./AccountsStore";
import { GeminiCredentialBackend } from "./Backend";
import { GeminiCredentialStore } from "./CredentialStore";
import { GEMINI_AGENT_ID } from "./types";
import { GeminiSessionIdentityReader } from "./Identity";
import { GeminiKeychainCredentialStore } from "./KeychainStore";
import { GEMINI_PROJECTION } from "./Projection";
import { RollbackLatestMutation } from "./RollbackLatestMutation";
import { GeminiSettingsStore } from "./SettingsStore";
import { MutationHistory } from "@nile/core/services/history";
import { FileSnapshotStore } from "@nile/core/services/history";
import { LiveSetupDetector } from "./live-setup/Detector";
import { LiveSetupMatcher } from "@nile/core/actions/live-setup";
import { GeminiSessionReader } from "./Reader";
import { LiveSetupReader } from "./live-setup/Reader";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("Gemini RollbackLatestMutation", () => {
  it("restores previous Gemini CLI files and clears selection", () => {
    const setup = createSetup();
    seedEndpoint(setup.dbPath);
    seedAccess(
      setup.dbPath,
      setup.credentialStore,
      {
        id: "gemini-primary-example-test",
        endpointId: "gemini",
        label: "gemini.primary@example.test",
        authMode: "gemini_cli_session",
        identityKey: "google-sub:google-sub-123",
      },
      {
        kind: "gemini_cli_session",
        accessToken: "gemini-access",
        refreshToken: "gemini-refresh",
        idToken: createJwt({ email: "gemini.primary@example.test", sub: "google-sub-123" }),
        expiryDate: 1800000000000,
      },
    );

    const context = AgentWorkspaceSession.open(setup.dbPath, setup.credentialStore);
    const mutationHistory = MutationHistory.fromDatabase(setup.dbPath, context.workspaceState.database, {
      secureSnapshotStore: setup.secureSnapshots,
      logger: NileLogger.silent(),
    });
    const apply = new ApplySelection(
      new ApplyMutation(
        mutationHistory,
        new AgentApplySupport(
          GEMINI_AGENT_ID,
          context.sharedContext.endpointRegistry,
          context.sharedContext.accessRegistry,
          context.agentSelection,
          context.sharedContext.agentConnectionSettings,
          NileLogger.silent(),
          (message) => new Error(message),
          (input) => GEMINI_PROJECTION.resolve(input),
        ),
        NileLogger.silent(),
      ),
      new GeminiCredentialBackend(
        new GeminiCredentialStore(setup.geminiHome),
        new GeminiKeychainCredentialStore(new MemoryGenericPasswordClient()),
      ),
      new GeminiAccountsStore(setup.geminiHome),
      new GeminiSettingsStore(setup.geminiHome),
      new GeminiSessionIdentityReader(),
    );

    apply.apply("gemini-primary-example-test");

    const rollback = new RollbackLatestMutation(
      mutationHistory,
      new FileSnapshotStore(join(setup.historyRoot)),
      setup.secureSnapshots,
      context.agentSelection,
      new LiveSetupDetector(
        new LiveSetupReader(
          new GeminiSessionReader(
            new GeminiCredentialBackend(
              new GeminiCredentialStore(setup.geminiHome),
              new GeminiKeychainCredentialStore(new MemoryGenericPasswordClient()),
            ),
            new GeminiAccountsStore(setup.geminiHome),
            new GeminiSettingsStore(setup.geminiHome),
          ),
        ),
        new LiveSetupMatcher(
          context.sharedContext.endpointRegistry,
          context.sharedContext.accessRegistry,
          context.agentSelection,
          GEMINI_AGENT_ID,
          context.sharedContext.agentConnectionSettings,
        ),
        NileLogger.silent(),
      ),
      new GeminiCredentialBackend(
        new GeminiCredentialStore(setup.geminiHome),
        new GeminiKeychainCredentialStore(new MemoryGenericPasswordClient()),
      ),
      new GeminiAccountsStore(setup.geminiHome),
      new GeminiSettingsStore(setup.geminiHome),
      NileLogger.silent(),
      context,
    );

    rollback.rollback();

    const selection = AgentSelection.open(setup.dbPath);
    expect(selection.get(GEMINI_AGENT_ID)).toBeNull();
    selection.close();
    expect(setup.settingsStore.snapshot()).toBeNull();
    expect(setup.accountsStore.snapshot()).toBeNull();
    expect(setup.fileStore.snapshot()).toBeNull();

    rollback.close();
  });
});

function createSetup() {
  const dir = mkdtempSync(join(tmpdir(), "nile-gemini-rollback-"));
  tempDirs.push(dir);
  const geminiHome = join(dir, ".gemini");
  mkdirSync(geminiHome, { recursive: true });
  return {
    dbPath: join(dir, "switcher.sqlite"),
    geminiHome,
    historyRoot: join(dir, "history"),
    settingsStore: new GeminiSettingsStore(geminiHome),
    accountsStore: new GeminiAccountsStore(geminiHome),
    fileStore: new GeminiCredentialStore(geminiHome),
    credentialStore: new StubCredentialStore(),
    secureSnapshots: new MemorySecureSnapshotStore(),
  };
}

function seedEndpoint(dbPath: string): void {
  const endpoints = EndpointRegistry.open(dbPath);
  endpoints.add({
    id: "gemini",
    label: "Gemini",
    rootUrl: "https://generativelanguage.googleapis.com",
    profile: "gemini-cli",
    protocols: {
      gemini: {
        authTypes: ["oauth-personal"],
      },
    },
  });
  endpoints.close();
}

function seedAccess(
  dbPath: string,
  credentialStore: StubCredentialStore,
  input: {
    id: string;
    endpointId: string;
    label: string;
    authMode: "gemini_cli_session";
    identityKey: string;
  },
  credential: StoredCredential,
): void {
  const accesses = AccessRegistry.open(dbPath, credentialStore);
  accesses.add(
    {
      id: input.id,
      endpointId: input.endpointId,
      label: input.label,
      authMode: input.authMode,
      identityKey: input.identityKey,
      enabledAgents: ["gemini"],
    },
    credential,
  );
  accesses.close();
}

function createJwt(payload: Record<string, string>): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

class MemoryGenericPasswordClient {
  read() {
    return {
      exitCode: 44,
      stdout: "",
      stderr: "The specified item could not be found in the keychain.",
    };
  }

  write() {
    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
  }

  remove() {
    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
  }
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
